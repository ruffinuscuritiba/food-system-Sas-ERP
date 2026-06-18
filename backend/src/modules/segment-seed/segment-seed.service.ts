import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

interface ProductDef {
  name: string;
  description?: string;
  salePrice: number;
  costPrice: number;
}

interface CategoryDef {
  name: string;
  products: ProductDef[];
}

const SEGMENT_DATA: Record<string, CategoryDef[]> = {
  RESTAURANTE: [
    { name: 'Entradas', products: [
      { name: 'Pão de Alho Gratinado', description: 'Pão italiano com alho e queijo derretido', salePrice: 16.9, costPrice: 5.0 },
      { name: 'Bolinho de Bacalhau (6un)', description: 'Bolinhos crocantes com molho de ervas', salePrice: 22.9, costPrice: 8.0 },
      { name: 'Caldo Verde', description: 'Caldo cremoso com linguiça defumada', salePrice: 18.9, costPrice: 6.0 },
    ]},
    { name: 'Pratos Principais', products: [
      { name: 'Filé à Parmegiana', description: 'Filé mignon com molho pomodoro e mussarela', salePrice: 44.9, costPrice: 18.0 },
      { name: 'Frango Grelhado', description: 'Frango com ervas finas, arroz e salada', salePrice: 36.9, costPrice: 12.0 },
      { name: 'Risoto de Camarão', description: 'Risoto cremoso com camarões frescos', salePrice: 52.9, costPrice: 22.0 },
      { name: 'Macarrão Bolonhesa', description: 'Espaguete ao molho bolonhesa caseiro', salePrice: 32.9, costPrice: 10.0 },
    ]},
    { name: 'Acompanhamentos', products: [
      { name: 'Arroz e Feijão', description: 'Arroz soltinho e feijão temperado', salePrice: 8.9, costPrice: 2.5 },
      { name: 'Batata Frita', description: 'Porção crocante de batata palito', salePrice: 18.9, costPrice: 5.0 },
      { name: 'Salada Verde', description: 'Mix de folhas com tomate e azeitona', salePrice: 14.9, costPrice: 4.0 },
    ]},
    { name: 'Bebidas', products: [
      { name: 'Refrigerante Lata 350ml', salePrice: 7.9, costPrice: 3.0 },
      { name: 'Suco Natural 400ml', description: 'Laranja, limão ou maracujá', salePrice: 14.9, costPrice: 4.0 },
      { name: 'Água Mineral 500ml', salePrice: 4.9, costPrice: 1.5 },
    ]},
  ],
  CONVENIENCIA: [
    { name: 'Bebidas', products: [
      { name: 'Refrigerante Lata 350ml', salePrice: 5.9, costPrice: 2.5 },
      { name: 'Cerveja Long Neck 355ml', salePrice: 6.9, costPrice: 3.0 },
      { name: 'Energético 250ml', salePrice: 8.9, costPrice: 4.0 },
      { name: 'Água Mineral 500ml', salePrice: 3.9, costPrice: 1.0 },
      { name: 'Suco de Caixinha 200ml', salePrice: 4.9, costPrice: 2.0 },
    ]},
    { name: 'Lanches & Snacks', products: [
      { name: 'Chips de Batata 90g', salePrice: 7.9, costPrice: 4.0 },
      { name: 'Amendoim Torrado 150g', salePrice: 5.9, costPrice: 2.5 },
      { name: 'Barra de Cereal', salePrice: 4.9, costPrice: 2.0 },
      { name: 'Biscoito Recheado', salePrice: 3.9, costPrice: 1.5 },
      { name: 'Wafer de Chocolate', salePrice: 3.9, costPrice: 1.5 },
    ]},
    { name: 'Congelados', products: [
      { name: 'Lasanha Individual 300g', salePrice: 14.9, costPrice: 7.0 },
      { name: 'Pizza Congelada 400g', salePrice: 22.9, costPrice: 10.0 },
      { name: 'Nuggets de Frango 300g', salePrice: 18.9, costPrice: 8.0 },
    ]},
    { name: 'Higiene & Beleza', products: [
      { name: 'Sabonete Líquido 250ml', salePrice: 6.9, costPrice: 3.0 },
      { name: 'Shampoo 200ml', salePrice: 8.9, costPrice: 4.0 },
      { name: 'Creme Dental 90g', salePrice: 7.9, costPrice: 3.5 },
    ]},
  ],
  LANCHONETE: [
    { name: 'Hambúrgueres', products: [
      { name: 'Hambúrguer Clássico', description: 'Blend artesanal, queijo, alface e tomate', salePrice: 28.9, costPrice: 12.0 },
      { name: 'Smash Burger Duplo', description: 'Dois blends smashed com cheddar derretido', salePrice: 38.9, costPrice: 16.0 },
      { name: 'Chicken Burger', description: 'Frango crocante com maionese de limão', salePrice: 32.9, costPrice: 13.0 },
      { name: 'Veggie Burger', description: 'Hambúrguer de grão-de-bico com legumes', salePrice: 29.9, costPrice: 11.0 },
    ]},
    { name: 'Batatas & Porções', products: [
      { name: 'Batata Frita Média', description: 'Porção crocante com molho opcional', salePrice: 16.9, costPrice: 5.0 },
      { name: 'Batata com Cheddar e Bacon', description: 'Batata frita com cheddar cremoso e bacon', salePrice: 22.9, costPrice: 8.0 },
      { name: 'Onion Rings', description: 'Anéis de cebola empanados e crocantes', salePrice: 18.9, costPrice: 6.0 },
    ]},
    { name: 'Bebidas', products: [
      { name: 'Milkshake 400ml', description: 'Chocolate, morango ou baunilha', salePrice: 18.9, costPrice: 6.0 },
      { name: 'Refrigerante 300ml', salePrice: 6.9, costPrice: 2.5 },
      { name: 'Suco Natural 300ml', salePrice: 12.9, costPrice: 4.0 },
    ]},
  ],
  CHURRASCARIA: [
    { name: 'Carnes', products: [
      { name: 'Picanha Grelhada 300g', description: 'Picanha premium grelhada na brasa', salePrice: 68.9, costPrice: 35.0 },
      { name: 'Costela Bovina 400g', description: 'Costela assada lentamente na churrasqueira', salePrice: 54.9, costPrice: 28.0 },
      { name: 'Frango na Brasa (1/2)', description: 'Frango temperado grelhado na brasa', salePrice: 32.9, costPrice: 14.0 },
      { name: 'Linguiça Artesanal', description: 'Porção de linguiça toscana defumada', salePrice: 24.9, costPrice: 10.0 },
    ]},
    { name: 'Acompanhamentos', products: [
      { name: 'Farofa Crocante', description: 'Farofa de manteiga com bacon e ovos', salePrice: 14.9, costPrice: 4.0 },
      { name: 'Vinagrete', description: 'Molho vinagrete com tomate e cebola', salePrice: 10.9, costPrice: 3.0 },
      { name: 'Arroz à Grega', description: 'Arroz temperado com legumes salteados', salePrice: 12.9, costPrice: 3.5 },
      { name: 'Pão de Alho', description: 'Pão italiano com alho e manteiga', salePrice: 12.9, costPrice: 3.0 },
    ]},
    { name: 'Bebidas', products: [
      { name: 'Cerveja Gelada 600ml', salePrice: 12.9, costPrice: 5.0 },
      { name: 'Caipirinha', description: 'Limão, vodka e açúcar', salePrice: 18.9, costPrice: 6.0 },
      { name: 'Refrigerante Lata', salePrice: 7.9, costPrice: 3.0 },
    ]},
  ],
  MARMITARIA: [
    { name: 'Marmitas', products: [
      { name: 'Marmita Pequena', description: 'Arroz, feijão, 1 proteína e acompanhamento', salePrice: 18.9, costPrice: 8.0 },
      { name: 'Marmita Grande', description: 'Arroz, feijão, 2 proteínas e 2 acompanhamentos', salePrice: 26.9, costPrice: 12.0 },
      { name: 'Marmita Executiva', description: 'Prato completo com suco incluso', salePrice: 34.9, costPrice: 15.0 },
    ]},
    { name: 'Proteínas', products: [
      { name: 'Frango Grelhado Extra', salePrice: 14.9, costPrice: 5.0 },
      { name: 'Carne Moída Extra', salePrice: 16.9, costPrice: 6.0 },
      { name: 'Peixe Grelhado Extra', salePrice: 18.9, costPrice: 7.0 },
      { name: 'Omelete Extra', salePrice: 10.9, costPrice: 3.0 },
    ]},
    { name: 'Vegetariano', products: [
      { name: 'Marmita Vegana', description: 'Proteína de soja, legumes no vapor e arroz integral', salePrice: 22.9, costPrice: 8.0 },
      { name: 'Bowl de Quinoa', description: 'Quinoa com grão-de-bico e vegetais assados', salePrice: 28.9, costPrice: 10.0 },
    ]},
    { name: 'Bebidas', products: [
      { name: 'Suco Natural 300ml', salePrice: 8.9, costPrice: 3.0 },
      { name: 'Água Mineral 500ml', salePrice: 3.9, costPrice: 1.0 },
    ]},
  ],
  HOT_DOG: [
    { name: 'Cachorros-Quentes', products: [
      { name: 'Hot Dog Clássico', description: 'Salsicha grelhada, molho, mostarda e ketchup', salePrice: 12.9, costPrice: 4.5 },
      { name: 'Hot Dog Especial', description: 'Salsicha, purê de batata, milho e ervilha', salePrice: 18.9, costPrice: 7.0 },
      { name: 'Hot Dog Italiano', description: 'Salsicha com catupiry, tomate seco e orégano', salePrice: 22.9, costPrice: 8.5 },
      { name: 'Hot Dog de Frango', description: 'Frango desfiado com cream cheese cremoso', salePrice: 20.9, costPrice: 8.0 },
    ]},
    { name: 'Complementos', products: [
      { name: 'Purê de Batata Extra', salePrice: 5.9, costPrice: 1.5 },
      { name: 'Batata Palha', salePrice: 4.9, costPrice: 1.5 },
      { name: 'Queijo Catupiry Extra', salePrice: 4.9, costPrice: 2.0 },
    ]},
    { name: 'Bebidas', products: [
      { name: 'Refrigerante 350ml', salePrice: 6.9, costPrice: 2.5 },
      { name: 'Suco de Laranja 300ml', salePrice: 10.9, costPrice: 3.5 },
    ]},
  ],
  PASTELARIA: [
    { name: 'Pastéis Salgados', products: [
      { name: 'Pastel de Carne', description: 'Carne moída temperada com azeitona', salePrice: 9.9, costPrice: 3.5 },
      { name: 'Pastel de Frango', description: 'Frango desfiado com catupiry', salePrice: 10.9, costPrice: 3.5 },
      { name: 'Pastel de Camarão', description: 'Camarão refogado com alho e limão', salePrice: 14.9, costPrice: 6.0 },
      { name: 'Pastel de Queijo', description: 'Queijo mussarela derretido', salePrice: 8.9, costPrice: 2.5 },
      { name: 'Pastel 4 Queijos', description: 'Mix de queijos especiais artesanais', salePrice: 12.9, costPrice: 4.5 },
    ]},
    { name: 'Pastéis Doces', products: [
      { name: 'Pastel de Chocolate', description: 'Recheio de chocolate belga derretido', salePrice: 10.9, costPrice: 3.5 },
      { name: 'Pastel de Banana', description: 'Banana nanica com canela e açúcar', salePrice: 9.9, costPrice: 3.0 },
      { name: 'Pastel Romeu & Julieta', description: 'Goiabada com queijo meia cura', salePrice: 10.9, costPrice: 3.5 },
    ]},
    { name: 'Caldos & Bebidas', products: [
      { name: 'Caldo de Cana 500ml', salePrice: 8.9, costPrice: 2.5 },
      { name: 'Suco de Laranja 500ml', salePrice: 10.9, costPrice: 3.5 },
      { name: 'Refrigerante 350ml', salePrice: 6.9, costPrice: 2.5 },
    ]},
  ],
  PADARIA: [
    { name: 'Pães & Bolos', products: [
      { name: 'Pão Francês (un)', salePrice: 1.2, costPrice: 0.4 },
      { name: 'Pão de Queijo (un)', salePrice: 3.9, costPrice: 1.2 },
      { name: 'Croissant de Manteiga', salePrice: 7.9, costPrice: 2.5 },
      { name: 'Bolo de Cenoura (fatia)', salePrice: 8.9, costPrice: 3.0 },
      { name: 'Bolo de Chocolate (fatia)', salePrice: 9.9, costPrice: 3.5 },
    ]},
    { name: 'Café da Manhã', products: [
      { name: 'Combo Pão + Ovo + Queijo', description: 'Pão francês, ovo mexido e queijo', salePrice: 14.9, costPrice: 5.0 },
      { name: 'Tapioca Recheada', description: 'Tapioca com recheio à escolha', salePrice: 12.9, costPrice: 4.0 },
      { name: 'Vitamina de Fruta', description: 'Fruta da estação com leite', salePrice: 12.9, costPrice: 4.0 },
    ]},
    { name: 'Bebidas Quentes', products: [
      { name: 'Café Expresso', salePrice: 5.9, costPrice: 1.5 },
      { name: 'Cappuccino', salePrice: 9.9, costPrice: 3.0 },
      { name: 'Chocolate Quente', salePrice: 10.9, costPrice: 3.5 },
    ]},
    { name: 'Bebidas Frias', products: [
      { name: 'Suco Natural 300ml', salePrice: 10.9, costPrice: 3.5 },
      { name: 'Refrigerante Lata', salePrice: 6.9, costPrice: 2.5 },
    ]},
  ],
  DOCERIA: [
    { name: 'Bolos', products: [
      { name: 'Bolo Trufado de Chocolate', description: 'Bolo úmido com ganache e confeitos', salePrice: 9.9, costPrice: 3.5 },
      { name: 'Bolo Red Velvet', description: 'Bolo americano com cream cheese', salePrice: 11.9, costPrice: 4.5 },
      { name: 'Bolo de Morango', description: 'Bolo branco com morangos frescos', salePrice: 10.9, costPrice: 4.0 },
      { name: 'Cheesecake (fatia)', description: 'Cheesecake com calda de frutas vermelhas', salePrice: 14.9, costPrice: 5.5 },
    ]},
    { name: 'Doces & Brigadeiros', products: [
      { name: 'Caixa de Brigadeiros (9un)', description: 'Mix de brigadeiros gourmet', salePrice: 34.9, costPrice: 12.0 },
      { name: 'Brigadeiro Gourmet (un)', description: 'Brigadeiro recheado tamanho grande', salePrice: 4.9, costPrice: 1.5 },
      { name: 'Trufa de Chocolate (un)', description: 'Trufa artesanal com recheio cremoso', salePrice: 5.9, costPrice: 2.0 },
      { name: 'Beijinho de Coco (6un)', description: 'Beijinho tradicional coberto com coco', salePrice: 18.9, costPrice: 6.0 },
    ]},
    { name: 'Tortas', products: [
      { name: 'Torta de Limão (fatia)', description: 'Torta cremosa com merengue tostado', salePrice: 12.9, costPrice: 4.5 },
      { name: 'Pudim de Leite Condensado', description: 'Pudim tradicional com calda de caramelo', salePrice: 9.9, costPrice: 3.0 },
    ]},
    { name: 'Bebidas Quentes', products: [
      { name: 'Café Expresso', salePrice: 5.9, costPrice: 1.5 },
      { name: 'Chocolate Quente', salePrice: 10.9, costPrice: 3.5 },
      { name: 'Chá Especial', salePrice: 8.9, costPrice: 2.5 },
    ]},
  ],
};

@Injectable()
export class SegmentSeedService {
  private readonly logger = new Logger(SegmentSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates categories and products for a company based on its business segment.
   * Safe to call multiple times — skips if products already exist.
   */
  async seedForCompany(companyId: string, segment: string): Promise<void> {
    const existing = await this.prisma.category.count({ where: { companyId } });
    if (existing > 0) {
      this.logger.log(`[SegmentSeed] Company ${companyId} already has categories — skipping`);
      return;
    }

    const categories = SEGMENT_DATA[segment] ?? SEGMENT_DATA['RESTAURANTE'];
    let catSortOrder = 0;

    for (const catDef of categories) {
      const category = await this.prisma.category.create({
        data: {
          name: catDef.name,
          companyId,
          sortOrder: catSortOrder++,
        },
      });

      let prodSortOrder = 0;
      for (const prodDef of catDef.products) {
        await this.prisma.product.create({
          data: {
            name: prodDef.name,
            description: prodDef.description ?? null,
            salePrice: prodDef.salePrice,
            costPrice: prodDef.costPrice,
            companyId,
            categoryId: category.id,
            isActive: true,
            trackStock: false,
            sortOrder: prodSortOrder++,
          },
        });
      }
    }

    this.logger.log(
      `[SegmentSeed] Seeded ${categories.length} categories for ${segment} company ${companyId}`,
    );
  }
}
