type Props = {

  title: string

  value: string | number

  color?: string
}

export function KpiCard({
  title,
  value,
  color,
}: Props) {

  return (

    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">

      <p className="text-gray-500">
        {title}
      </p>

      <h2
        className={`text-3xl font-bold mt-2 ${color}`}
      >
        {value}
      </h2>

    </div>
  )
}