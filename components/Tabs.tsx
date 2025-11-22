import React from 'react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeTab, onChange }) => {
  return (
    <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
              ${isActive 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }
            `}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};