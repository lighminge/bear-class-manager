import { Sun, Home as HomeIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date();
  
  const isHome = location.pathname === '/';

  return (
    <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b-4 border-white/50 pb-4 border-dashed">
      <div 
        className="flex items-center gap-3 cursor-pointer group" 
        onClick={() => navigate('/')}
      >
        <span className="text-4xl group-hover:animate-bounce transition-transform">🐻</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-widest text-yellow-100 group-hover:text-yellow-300 transition-colors">
          小熊班 資訊系統
        </h1>
      </div>
      
      <div className="flex items-center gap-6 mt-4 md:mt-0">
        {/* 天氣與日曆 */}
        <div className="flex items-center gap-4 bg-white/10 p-3 rounded-xl border border-white/30 backdrop-blur-sm shadow-lg">
          <div className="flex flex-col items-center justify-center border-2 border-white rounded bg-red-900 overflow-hidden shadow-inner w-16 h-20">
            <div className="bg-red-600 w-full text-center text-xs py-0.5 text-white font-bold border-b border-white">
              {today.getMonth() + 1}月
            </div>
            <div className="bg-white w-full flex-1 flex items-center justify-center text-red-900 font-bold text-2xl">
              {today.getDate().toString().padStart(2, '0')}
            </div>
            <div className="bg-red-800 w-full text-center text-[10px] py-0.5 text-white font-bold border-t border-white">
              星期{['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center text-center w-16" title="臺中市即時天氣">
            <div className="text-3xl flex justify-center">
              <Sun className="text-yellow-300 w-8 h-8" />
            </div>
            <span className="text-sm mt-1 font-bold">--°C</span>
            <span className="text-sm text-yellow-100 font-bold tracking-widest mt-0.5">晴朗</span>
          </div>
        </div>
        
        {!isHome && (
          <button 
            onClick={() => navigate('/')} 
            className="chalk-btn"
          >
            <HomeIcon className="w-5 h-5" /> 回首頁
          </button>
        )}
      </div>
    </header>
  );
}
