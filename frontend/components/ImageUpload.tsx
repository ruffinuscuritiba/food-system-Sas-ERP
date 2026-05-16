"use client";
import { apiBaseUrl } from "@/services/env";

import {
  useState,
} from "react";

import axios from "axios";

type Props = {

  value?: string;

  onChange: (
    url: string,
  ) => void;
};

export default function ImageUpload({

  value,

  onChange,
}: Props) {

  const [loading, setLoading] =
    useState(false);

  async function uploadImage(
    event: any,
  ) {

    const file =
      event.target.files?.[0];

    if (!file) return;

    setLoading(true);

    const formData =
      new FormData();

    formData.append(
      "file",
      file,
    );

    try {

      const response =
        await axios.post(

          `${apiBaseUrl}/upload`,

          formData,

          {

            headers: {

              "Content-Type":
                "multipart/form-data",
            },
          },
        );

      onChange(
        response.data.url,
      );

    } catch (error) {

      alert(
        "Erro upload",
      );
    }

    setLoading(false);
  }

  return (

    <div className="space-y-4">

      {value && (

        <img
          src={value}
          className="w-full h-64 object-cover rounded-3xl border"
        />
      )}

      <label className="block">

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center cursor-pointer hover:border-green-500 transition">

          {loading
            ? "Enviando..."
            : "Selecionar imagem"}

        </div>

        <input
          type="file"
          className="hidden"
          onChange={
            uploadImage
          }
        />

      </label>

    </div>
  );
}