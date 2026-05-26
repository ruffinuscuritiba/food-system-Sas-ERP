import {
  useState,
} from "react";

type Props = {

  open: boolean;

  total: number;

  onClose: () => void;

  onConfirm: (
    paymentMethod: string,
    received: number,
  ) => void;
};

export function PaymentModal({

  open,

  total,

  onClose,

  onConfirm,
}: Props) {

  const [paymentMethod, setPaymentMethod] =
    useState("PIX");

  const [received, setReceived] =
    useState<number>(0);

  if (!open) {
    return null;
  }

  const change =
    received > total

      ? received - total

      : 0;

  return (

    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >

      <div
        className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 p-8"
      >

        <h2 className="text-4xl font-bold mb-8">
          Pagamento
        </h2>

        <div className="space-y-6">

          <div>

            <p className="text-slate-400 mb-2">
              Forma de pagamento
            </p>

            <select
              value={paymentMethod}

              onChange={(e) =>
                setPaymentMethod(
                  e.target.value,
                )
              }

              className="w-full bg-slate-800 p-4 rounded-2xl"
            >

              <option value="PIX">
                PIX
              </option>

              <option value="CASH">
                Dinheiro
              </option>

              <option value="CARD">
                Cartão
              </option>

            </select>

          </div>

          <div>

            <p className="text-slate-400 mb-2">
              Total
            </p>

            <div className="text-4xl font-black text-green-400">
              R$ {total.toFixed(2)}
            </div>

          </div>

          {paymentMethod === "CASH" && (

            <div>

              <p className="text-slate-400 mb-2">
                Valor recebido
              </p>

              <input
                type="number"

                value={received}

                onChange={(e) =>
                  setReceived(
                    Number(
                      e.target.value,
                    ),
                  )
                }

                className="w-full bg-slate-800 p-4 rounded-2xl"
              />

              <div className="mt-4">

                <p className="text-slate-400">
                  Troco
                </p>

                <div className="text-2xl font-bold text-yellow-400 mt-1">

                  R$ {change.toFixed(2)}

                </div>

              </div>

            </div>

          )}

        </div>

        <div className="grid grid-cols-2 gap-4 mt-10">

          <button
            onClick={onClose}

            className="bg-slate-800 hover:bg-slate-700 transition py-4 rounded-2xl font-bold"
          >
            Cancelar
          </button>

          <button
            onClick={() =>
              onConfirm(
                paymentMethod,
                received,
              )
            }

            className="bg-green-500 hover:bg-green-600 transition py-4 rounded-2xl font-bold"
          >
            Confirmar
          </button>

        </div>

      </div>

    </div>
  );
}