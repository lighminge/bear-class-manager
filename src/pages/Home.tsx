import { Map, Calendar, BookOpen, Users, Target, PhoneCall, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const modules = [
  { id: 'annual', title: '學校年度行事曆', desc: '設定學年度、學期與每週重點', icon: Map },
  { id: 'schedule', title: '每週排程行事曆', desc: '每週每日紀錄、教師輪值表', icon: Calendar },
  { id: 'books', title: '教室藏書管理', desc: '圖書資料、借閱紀錄、自動輪借', icon: BookOpen },
  { id: 'students', title: '學生資料管理', desc: '基本資料、聯絡人、過敏原紀錄', icon: Users },
  { id: 'indicators', title: '幼兒園學習指標', desc: '六大領域學習指標查詢與檢索、教案撰寫輔助', icon: Target },
  { id: 'teachers', title: '教師專區', desc: '教師資料管理、輪替與主教設定', icon: UserCheck },
];

export default function Home() {
  const navigate = useNavigate();

  const handleNav = (mod: typeof modules[0]) => {
    if (mod.external && mod.url) {
      window.open(mod.url, '_blank');
    } else {
      navigate(`/${mod.id}`);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto mt-12">
      {modules.map((mod, index) => {
        const Icon = mod.icon;
        return (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleNav(mod)}
            className="chalk-box flex flex-col items-center text-center cursor-pointer group hover:bg-[#346b4b] transition-colors relative overflow-hidden"
          >
            <motion.div 
              className="text-yellow-300 mb-4"
              whileHover={{ scale: 1.2, rotate: 5 }}
            >
              <Icon className="w-12 h-12" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2 tracking-wider">{mod.title}</h2>
            <p className="text-green-100 text-sm">{mod.desc}</p>
            <div className="mt-auto pt-6 text-2xl text-yellow-100/50 group-hover:text-yellow-100/80 transition-colors">
              🐾
            </div>
            
            {/* 裝飾性背景元素 */}
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Icon className="w-32 h-32" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
