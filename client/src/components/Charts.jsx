import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20', '#319795']

export function StockByCategoryChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No category data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
        <XAxis dataKey="category" tick={{ fontSize: 12, fill: 'var(--gray-500)' }} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--gray-500)' }} />
        <Tooltip
          contentStyle={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.85rem' }}
          formatter={(value) => [value, 'Quantity']}
        />
        <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TransactionsOverTimeChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No transaction data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--gray-500)' }}
          tickFormatter={(val) => {
            const d = new Date(val)
            return `${d.getMonth() + 1}/${d.getDate()}`
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: 'var(--gray-500)' }} />
        <Tooltip
          contentStyle={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.85rem' }}
          labelFormatter={(val) => new Date(val).toLocaleDateString()}
        />
        <Legend />
        <Line type="monotone" dataKey="stock_in" name="Stock In" stroke="#38a169" strokeWidth={2} dot={{ fill: '#38a169', r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="stock_out" name="Stock Out" stroke="#e53e3e" strokeWidth={2} dot={{ fill: '#e53e3e', r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function StockStatusPieChart({ inStock, lowStock }) {
  const data = [
    { name: 'In Stock', value: inStock || 0 },
    { name: 'Low Stock', value: lowStock || 0 }
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return <div className="chart-empty">No items to display</div>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={4}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          <Cell fill="#38a169" />
          <Cell fill="#e53e3e" />
        </Pie>
        <Tooltip
          contentStyle={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '8px', fontSize: '0.85rem' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
