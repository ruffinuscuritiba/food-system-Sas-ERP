type Props = {

  categories: any[];

  selectedCategory: string;

  onSelect: (
    category: string,
  ) => void;
};

export function CategorySidebar({

  categories,

  selectedCategory,

  onSelect,
}: Props) {

  return (

    <aside
      className="w-[280px] bg-slate-900 border-r border-slate-800 p-5 overflow-auto"
    >

      <h2 className="text-3xl font-bold mb-8">
        Categorias
      </h2>

      <div className="space-y-3">

        {categories.map(
          (category) => (

            <button
              key={category.id}

              onClick={() =>
                onSelect(
                  category.id,
                )
              }

              className={`

                w-full
                text-left
                p-4
                rounded-2xl
                transition
                font-semibold

                ${
                  selectedCategory ===
                  category.id

                    ? "bg-green-500 text-white"

                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }
              `}
            >

              {category.name}

            </button>

          ),
        )}

      </div>

    </aside>
  );
}