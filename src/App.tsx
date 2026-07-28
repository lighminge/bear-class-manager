import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, signInAnonymously, onAuthStateChanged } from './lib/firebase';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import StudentsManagement from './pages/StudentsManagement';
import BooksManagement from './pages/BooksManagement';
import AnnualCalendar from './pages/AnnualCalendar';
import Indicators from './pages/Indicators';
import WeeklySchedule from './pages/WeeklySchedule';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 匿名登入邏輯
    const initAuth = async () => {
      try {
        await auth.authStateReady();
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 設定稍微延遲以顯示可愛的載入畫面
        setTimeout(() => setLoading(false), 1000);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#2b5b3f] z-50 flex items-center justify-center flex-col gap-4 text-center">
        <div className="animate-bounce mb-2 text-6xl">🐻</div>
        <div className="text-2xl font-bold">系統載入中...</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="p-4 md:p-8 flex flex-col min-h-screen">
        <Header />
        <Sidebar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/annual" element={<AnnualCalendar />} />
            <Route path="/schedule" element={<WeeklySchedule />} />
            <Route path="/indicators" element={<Indicators />} />
            <Route path="/students" element={<StudentsManagement />} />
            <Route path="/books" element={<BooksManagement />} />
            {/* 其他頁面陸續加入 */}
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
