import { useState }
from "react";

import api
from "@/services/api";

export function useOrders() {

  const [loading, setLoading] =
    useState(false);

  async function createOrder(
    data: any,
  ) {

    try {

      setLoading(true);

      const response =
        await api.post(
          "/orders",
          data,
        );

      return response.data;

    } catch (error) {

      console.log(error);

      throw error;

    } finally {

      setLoading(false);
    }
  }

  return {

    loading,

    createOrder,
  };
}