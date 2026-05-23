import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { LineItem } from '../types';

interface AnalysisChartsProps {
  data: LineItem[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Helper to format numbers in tooltip without forcing zeros
const formatNumber = (value: number) => {
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' JPY';
};

const AnalysisCharts: React.FC<AnalysisChartsProps> = ({ data }) => {
  // Aggregate data for Pie Chart (Category detection based on Line Code)
  const categoryData = React.useMemo(() => {
    const categories: Record<string, number> = {
      'Ground Handling': 0,
      'Services': 0,
      'Reimbursement': 0
    };

    data.forEach(item => {
      // Logic based on the prompt's mapping
      if (item.lineCode.includes('/GH34/0') || item.lineCode.includes('/GH34/7')) {
         if (['04','10','11','13','23'].some(code => item.lineCode.endsWith(code))) {
             categories['Services'] += item.totalAmount;
         } else {
             categories['Ground Handling'] += item.totalAmount;
         }
      } else if (['/GH34/31', '/GH34/90', '/GH34/91', '/GH34/92'].some(s => item.lineCode.includes(s))) {
         categories['Reimbursement'] += item.totalAmount;
      } else {
         categories['Services'] += item.totalAmount;
      }
    });

    return Object.entries(categories)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
  }, [data]);

  // Top cost items for Bar Chart
  const topItems = React.useMemo(() => {
    return [...data]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)
      .map(item => ({
        name: item.description.length > 20 ? item.description.substring(0, 20) + '...' : item.description,
        amount: item.totalAmount
      }));
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Distribution Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Cost Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatNumber(value)} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Items Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Top 5 Cost Items</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topItems}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12}} />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                formatter={(value: number) => formatNumber(value)}
              />
              <Bar dataKey="amount" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalysisCharts;