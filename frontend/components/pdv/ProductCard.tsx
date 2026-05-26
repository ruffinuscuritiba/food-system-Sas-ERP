type Props = {

  product: any;

  onAdd: (
    product: any,
  ) => void;
};

export function ProductCard({

  product,

  onAdd,
}: Props) {

  return (

    <div
      className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800"
    >

      <img
        src={
          product.imageUrl ||
          "https://images.unsplash.com/photo-1513104890138-7c749659a591"
        }
        className="w-full h-44 object-cover"
      />

      <div className="p-5">

        <h2 className="text-xl font-bold">
          {product.name}
        </h2>

        <p className="text-slate-400 text-sm mt-2">
          {product.description}
        </p>

        <div className="flex items-center justify-between mt-6">

          <span className="text-2xl font-bold text-green-400">
            R$ {product.salePrice}
          </span>

          <button
            onClick={() =>
              onAdd(product)
            }
            className="bg-green-500 hover:bg-green-600 transition px-5 py-3 rounded-2xl font-bold"
          >
            Adicionar
          </button>

        </div>

      </div>

    </div>
  );
}