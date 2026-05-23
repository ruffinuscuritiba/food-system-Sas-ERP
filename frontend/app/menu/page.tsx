"use client";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

type Product = {
  id: string;
  name: string;
  description: string;
  salePrice: number;
  imageUrl: string | null;
  category?: { name: string };
  isActive: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
  notes: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  orderType: "DELIVERY" | "PICKUP";
  paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
};

function MenuContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("c") || "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
