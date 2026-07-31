import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

/** Distância em km entre duas coordenadas (fórmula de Haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class DeliveryConfigService {
  private readonly logger = new Logger('DeliveryConfigService');

  constructor(private prisma: PrismaService) {}

  private async tryNominatim(qs: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
        headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'FoodSaaS-ERP/1.0' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return { lat, lng };
    } catch (err: any) {
      this.logger.warn(`tryNominatim falhou: ${err?.message}`);
      return null;
    }
  }

  /**
   * Geocodifica um endereço pra lat/lng via Nominatim (OpenStreetMap, sem
   * chave de API — mesmo serviço já usado no autocomplete de rua do
   * cardápio digital). Server-side, então funciona pra qualquer canal de
   * pedido (PDV/cardápio/WhatsApp) sem precisar ensinar cada frontend a
   * geocodificar por conta própria.
   *
   * Duas tentativas: (1) busca livre (`q=`) com a linha inteira — funciona
   * bem pra ruas conhecidas; (2) busca ESTRUTURADA (`street=`/`city=`/
   * `state=`) quando a livre não acha nada — confirmado na prática que a
   * estruturada acha ruas que a livre não acha, mesmo endereço idêntico
   * (rua real de Curitiba testada: livre = 0 resultados, estruturada =
   * resultado exato de primeira).
   */
  private async geocodeAddress(
    addressLine: string,
    city?: string | null,
    state?: string | null,
  ): Promise<{ lat: number; lng: number } | null> {
    const q = [addressLine, city, state, 'Brasil'].filter(Boolean).join(', ');
    const free = await this.tryNominatim(
      `format=json&q=${encodeURIComponent(q)}&countrycodes=br&limit=1`,
    );
    if (free) return free;

    if (!city) return null;
    const structuredParams = new URLSearchParams({
      format: 'json',
      street: addressLine,
      city,
      country: 'Brasil',
      limit: '1',
    });
    if (state) structuredParams.set('state', state);
    return this.tryNominatim(structuredParams.toString());
  }

  /**
   * Resolve a zona de entrega (e portanto a taxa) pro pedido — ponto único
   * usado por PDV, cardápio digital e edição de pedido. Antes só sabia
   * casar `Company.deliveryMethod=NEIGHBORHOOD` (nome de bairro); lojas
   * configuradas como RADIUS (cobrança por distância) sempre voltavam null
   * aqui, então a taxa nunca era calculada (achado real: taxa sempre R$0
   * numa loja com zonas RADIUS cadastradas e preço configurado).
   *
   * RADIUS exige: (1) Company.storeLat/storeLng definidos (loja marca no
   * mapa em Configurações > Entrega) e (2) o endereço do cliente
   * geocodificável. Sem qualquer um dos dois, retorna null (mesmo
   * comportamento de "sem zona" de antes — nunca bloqueia o pedido).
   */
  async resolveDeliveryFee(
    companyId: string,
    opts: { neighborhood?: string | null; addressLine?: string | null },
  ): Promise<{ id: string; clientFee: any; driverShare: any } | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { deliveryMethod: true, storeLat: true, storeLng: true, city: true, state: true },
    });
    if (!company) return null;

    if (company.deliveryMethod === 'RADIUS') {
      if (company.storeLat == null || company.storeLng == null) {
        this.logger.warn(
          `resolveDeliveryFee: empresa ${companyId} é RADIUS mas não tem storeLat/storeLng configurados`,
        );
        return null;
      }
      if (!opts.addressLine) return null;

      const coords = await this.geocodeAddress(opts.addressLine, company.city, company.state);
      if (!coords) return null;

      const distanceKm = haversineKm(
        Number(company.storeLat),
        Number(company.storeLng),
        coords.lat,
        coords.lng,
      );

      const zones = await this.prisma.deliveryZone.findMany({
        where: { companyId, isActive: true, type: 'RADIUS', radiusKm: { not: null } },
        orderBy: { radiusKm: 'asc' },
        select: { id: true, radiusKm: true, clientFee: true, driverShare: true },
      });
      // Faixas concêntricas (11km/12km/13km...) — a primeira cujo raio
      // alcance a distância real do cliente é a que vale.
      const match = zones.find((z) => distanceKm <= Number(z.radiusKm));
      if (!match) return null;
      return { id: match.id, clientFee: match.clientFee, driverShare: match.driverShare };
    }

    // NEIGHBORHOOD (comportamento já existente)
    if (!opts.neighborhood) return null;
    return this.prisma.deliveryZone.findFirst({
      where: {
        companyId,
        isActive: true,
        type: 'NEIGHBORHOOD',
        neighborhood: { equals: opts.neighborhood, mode: 'insensitive' },
      },
      select: { id: true, clientFee: true, driverShare: true },
    });
  }

  findAll(companyId: string) {
    return this.prisma.deliveryZone.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async create(companyId: string, data: any) {
    return this.prisma.deliveryZone.create({
      data: {
        companyId,
        name: data.name,
        type: data.type ?? 'NEIGHBORHOOD',
        neighborhood: data.neighborhood ?? null,
        baseFee: data.baseFee ? Number(data.baseFee) : null,
        pricePerKm: data.pricePerKm ? Number(data.pricePerKm) : null,
        clientFee: Number(data.clientFee ?? 0),
        driverShare: Number(data.driverShare ?? 0),
        radiusKm: data.radiusKm ? Number(data.radiusKm) : null,
        lat: data.lat ? Number(data.lat) : null,
        lng: data.lng ? Number(data.lng) : null,
        color: data.color ?? '#f97316',
      },
    });
  }

  async update(id: string, companyId: string, data: any) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, companyId },
    });
    if (!zone) throw new NotFoundException('Zona não encontrada');

    return this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
        ...(data.baseFee !== undefined && { baseFee: Number(data.baseFee) }),
        ...(data.pricePerKm !== undefined && { pricePerKm: Number(data.pricePerKm) }),
        ...(data.clientFee !== undefined && { clientFee: Number(data.clientFee) }),
        ...(data.driverShare !== undefined && { driverShare: Number(data.driverShare) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.radiusKm !== undefined && { radiusKm: data.radiusKm ? Number(data.radiusKm) : null }),
        ...(data.lat !== undefined && { lat: data.lat ? Number(data.lat) : null }),
        ...(data.lng !== undefined && { lng: data.lng ? Number(data.lng) : null }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  }

  async remove(id: string, companyId: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, companyId },
    });
    if (!zone) throw new NotFoundException('Zona não encontrada');
    return this.prisma.deliveryZone.delete({ where: { id } });
  }

  // Returns public zone list (no driverShare) — safe to expose without auth
  async findAllPublic(slugOrId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    if (!company) return [];
    const companyId = company.id;
    return this.prisma.deliveryZone.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        neighborhood: true,
        clientFee: true,
        type: true,
      },
    });
  }

}
