import {
  useEffect,
  useState,
} from "react";

import api
from "@/services/api";

export function useKitchen() {

  const [orders, setOrders] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  async function loadKitchen() {

    try {

      setLoading(true);

      const response =
        await api.get(
          "/orders",
        );

      setOrders(
        response.data || [],
      );

    } catch (error) {

      console.log(error);

    } finally {

      setLoading(false);
    }
  }

  async function updateStatus(
    id: string,
    productionStatus: string,
  ) {

    try {

      await api.patch(

        `/orders/${id}/production-status`,

        {
          productionStatus,
        },
      );

      await loadKitchen();

    } catch (error) {

      console.log(error);
    }
  }

  useEffect(() => {

    loadKitchen();

  }, []);

  return {

    orders,

    loading,

    loadKitchen,

    updateStatus,
  };
}