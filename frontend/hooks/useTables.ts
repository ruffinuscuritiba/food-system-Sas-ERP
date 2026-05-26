import {
  useEffect,
  useState,
} from "react";

import api
from "@/services/api";

export function useTables() {

  const [tables, setTables] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  async function loadTables() {

    try {

      setLoading(true);

      const response =
        await api.get(
          "/tables",
        );

      setTables(
        response.data || [],
      );

    } catch (error) {

      console.log(error);

    } finally {

      setLoading(false);
    }
  }

  async function createTable(
    data: any,
  ) {

    try {

      await api.post(
        "/tables",
        data,
      );

      loadTables();

    } catch (error) {

      console.log(error);
    }
  }

  async function updateTableStatus(
    id: string,
    status: string,
  ) {

    try {

      await api.patch(
        `/tables/${id}/status`,
        {
          status,
        },
      );

      loadTables();

    } catch (error) {

      console.log(error);
    }
  }

  useEffect(() => {

    loadTables();

  }, []);

  return {

    tables,

    loading,

    loadTables,

    createTable,

    updateTableStatus,
  };
}