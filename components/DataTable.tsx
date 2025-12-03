import React from 'react';

interface ColumnDef {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: ColumnDef[];
  data: any[];
  maxHeight?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ columns, data, maxHeight = "300px" }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <p className="text-sm font-medium">暂无数据</p>
      </div>
    );
  }

  return (
    <div 
      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5"
    >
      <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight }}>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.key}
                  className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50/95 backdrop-blur-sm"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100 text-sm">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-3 whitespace-nowrap text-slate-600 group-hover:text-slate-900">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 px-6 py-2.5 text-xs font-medium text-slate-500 border-t border-slate-100 flex justify-between items-center">
        <span>显示前 {Math.min(data.length, 100)} 条</span>
        <span>共 {data.length} 条数据</span>
      </div>
    </div>
  );
};