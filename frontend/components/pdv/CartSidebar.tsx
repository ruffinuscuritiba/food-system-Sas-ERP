type Props = {

  cart: any[];

  total: number;

  onFinish: () => void;
};

export function CartSidebar({

  cart,

  total,

  onFinish,
}: Props) {

  return (

    <aside
      className="w-[400px] bg-slate-900 border-l border-slate-800 p-6 flex flex-col"
    >

      <h2 className="text-3xl font-bold mb-8">
        Carrinho
      </h2>

      <div className="flex-1 overflow-auto space-y-4">

        {cart.map(
          (item) => (

            <div
              key={item.id}
              className="bg-slate-800 rounded-2xl p-4"
            >

              <div className="flex justify-between">

                <div>

                  <h3 className="font-bold">
                    {item.name}
                  </h3>

                  <p className="text-slate-400 text-sm">
                    Qtd:
                    {" "}
                    {item.quantity}
                  </p>

                </div>

                <div className="font-bold text-green-400">
                  R$ {item.price}
                </div>

              </div>

            </div>

          ),
        )}

      </div>

      <div className="mt-6">

        <div className="flex justify-between text-2xl font-bold mb-6">

          <span>Total</span>

          <span>
            R$ {total.toFixed(2)}
          </span>

        </div>

        <button
          onClick={onFinish}
          className="w-full bg-green-500 hover:bg-green-600 transition py-5 rounded-2xl font-bold text-xl"
        >
          Finalizar Pedido
        </button>

      </div>

    </aside>
  );
}