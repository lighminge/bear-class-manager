import { useState } from 'react';
import { Users, UserCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Attendance from './Attendance';
import TeacherLeaves from './TeacherLeaves';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<'none' | 'attendance' | 'leaves'>('none');

  return (
    <>
      {/* 懸浮按鈕 */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
        <button
          onClick={() => setActiveTab(activeTab === 'attendance' ? 'none' : 'attendance')}
          className={`flex items-center justify-center p-3 gap-2 rounded-r-xl border-y-2 border-r-2 shadow-xl transition-colors ${
            activeTab === 'attendance' ? 'bg-yellow-600 border-yellow-400' : 'bg-black/50 border-white/20 hover:bg-black/70'
          }`}
          title="點名簿"
        >
          <Users className="w-6 h-6 text-white" />
          <span className="font-bold text-white whitespace-nowrap hidden sm:inline">點名簿</span>
        </button>
        <button
          onClick={() => setActiveTab(activeTab === 'leaves' ? 'none' : 'leaves')}
          className={`flex items-center justify-center p-3 gap-2 rounded-r-xl border-y-2 border-r-2 shadow-xl transition-colors ${
            activeTab === 'leaves' ? 'bg-yellow-600 border-yellow-400' : 'bg-black/50 border-white/20 hover:bg-black/70'
          }`}
          title="老師請假"
        >
          <UserCheck className="w-6 h-6 text-white" />
          <span className="font-bold text-white whitespace-nowrap hidden sm:inline">老師請假</span>
        </button>
      </div>

      {/* 抽屜 (Drawer) */}
      <AnimatePresence>
        {activeTab !== 'none' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveTab('none')}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 md:w-96 shadow-2xl z-50 border-r-2 border-white/20"
            >
              <button 
                onClick={() => setActiveTab('none')}
                className="absolute top-4 right-4 z-50 text-white/50 hover:text-white bg-black/30 rounded-full p-1"
              >
                <X className="w-6 h-6" />
              </button>
              
              {activeTab === 'attendance' && <Attendance />}
              {activeTab === 'leaves' && <TeacherLeaves />}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
