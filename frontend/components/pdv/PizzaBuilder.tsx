"use client";

import {
  useMemo,
  useState,
} from "react";

type Flavor = {

  id: string;

  name: string;

  price: number;
};

type Border = {

  id: string;

  name: string;

  price: number;
};

type Props = {

  flavors: Flavor[];

  borders: Border[];

  onAdd: (
    pizza: any,
  ) => void;
};

export function PizzaBuilder({

  flavors,

  borders,

  onAdd,
}: Props) {

  const [size, setSize] =
    useState("MEDIA");

  const [selectedFlavors, setSelectedFlavors] =
    useState<Flavor[]>([]);

  const [border, setBorder] =
    useState<Border | null>(null);

  const [notes, setNotes] =
    useState("");

  function toggleFlavor(
    flavor: Flavor,
  ) {

    const exists =
      selectedFlavors.find(
        (item) =>
          item.id === flavor.id,
      );

    if (exists) {

      setSelectedFlavors(
        selectedFlavors.filter(
          (item) =>
            item.id !==
            flavor.id,
        ),
      );

      return;
    }

    if (
      selectedFlavors.length >=
      2
    ) {
      return;
    }

    setSelectedFlavors([
      ...selectedFlavors,
      flavor,
    ]);
  }

  const pizzaPrice =
    useMemo(() => {

      const highestFlavor =
        Math.max(

          ...selectedFlavors.map(
            (f) => f.price,
          ),

          0,
        );

      const borderPrice =
        border?.price || 0;

      const sizeMultiplier =

        size === "PEQUENA"

          ? 1

        : size === "MEDIA"

          ? 1.2

        : 1.5;

      return (
        highestFlavor *
          sizeMultiplier +
        borderPrice
      );

    }, [
      selectedFlavors,
      border,
      size,
    ]);

  function addPizza() {

    if (
      selectedFlavors.length ===
      0
    ) {
      return;
    }

    onAdd({

      id: Date.now(),

      type: "PIZZA",

      size,

      flavors:
        selectedFlavors,

      border,

      notes,

      quantity: 1,

      name:
        selectedFlavors
          .map(
            (f) => f.name,
          )
          .join(" / "),

      price:
        pizzaPrice,
    });

    setSelectedFlavors([]);

    setBorder(null);

    setNotes("");
  }

  return (

    <div
      className="bg-slate-900 rounded-3xl border border-slate-800 p-6"
    >

      <h2 className="text-3xl font-bold mb-8">
        Montar Pizza
      </h2>

      <div className="space-y-8">

        <div>

          <p className="text-slate-400 mb-4">
            Tamanho
          </p>

          <div className="grid grid-cols-3 gap-3">

            {[
              "PEQUENA",
              "MEDIA",
              "GRANDE",
            ].map((item) => (

              <button
                key={item}

                onClick={() =>
                  setSize(item)
                }

                className={`

                  p-4 rounded-2xl font-bold transition

                  ${
                    size === item

                      ? "bg-green-500"

                      : "bg-slate-800"
                  }
                `}
              >

                {item}

              </button>

            ))}

          </div>

        </div>

        <div>

          <p className="text-slate-400 mb-4">
            Sabores
          </p>

          <div className="grid grid-cols-2 gap-3">

            {flavors.map(
              (flavor) => {

                const selected =
                  selectedFlavors.some(
                    (f) =>
                      f.id ===
                      flavor.id,
                  );

                return (

                  <button
                    key={flavor.id}

                    onClick={() =>
                      toggleFlavor(
                        flavor,
                      )
                    }

                    className={`

                      p-4 rounded-2xl text-left transition

                      ${
                        selected

                          ? "bg-green-500"

                          : "bg-slate-800"
                      }
                    `}
                  >

                    <div className="font-bold">
                      {flavor.name}
                    </div>

                    <div className="text-sm opacity-70 mt-1">

                      R$ {flavor.price}

                    </div>

                  </button>

                );
              },
            )}

          </div>

        </div>

        <div>

          <p className="text-slate-400 mb-4">
            Borda
          </p>

          <select
            className="w-full bg-slate-800 p-4 rounded-2xl"

            onChange={(e) => {

              const selected =
                borders.find(
                  (border) =>
                    border.id ===
                    e.target.value,
                );

              setBorder(
                selected || null,
              );
            }}
          >

            <option value="">
              Sem borda
            </option>

            {borders.map(
              (border) => (

                <option
                  key={border.id}
                  value={border.id}
                >

                  {border.name}
                  {" "}
                  (+R$ {border.price})

                </option>

              ),
            )}

          </select>

        </div>

        <div>

          <textarea
            placeholder="Observações"

            value={notes}

            onChange={(e) =>
              setNotes(
                e.target.value,
              )
            }

            className="w-full bg-slate-800 p-4 rounded-2xl h-32"
          />

        </div>

        <div className="flex items-center justify-between">

          <div>

            <p className="text-slate-400">
              Total
            </p>

            <h3 className="text-4xl font-black text-green-400">

              R$ {pizzaPrice.toFixed(2)}

            </h3>

          </div>

          <button
            onClick={addPizza}

            className="bg-green-500 hover:bg-green-600 transition px-8 py-5 rounded-2xl font-bold text-xl"
          >

            Adicionar

          </button>

        </div>

      </div>

    </div>
  );
}