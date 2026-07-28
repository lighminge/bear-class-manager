import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookOpen, CheckSquare, PlusCircle, PenTool, Trash2, Loader2, Printer, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

interface Book {
  id: string;
  bookNo: string;
  title: string;
  author: string;
  isBorrowed: string;
  borrower: string;
  borrowDate: string;
  returnDate: string;
}

interface Student {
  id: string;
  seatNo: string;
  name: string;
  academicYear: string;
  status: string;
}

// Pagination Helper Component
function Pagination({ total, current, pageSize, onPageChange, onPageSizeChange }: any) {
  const pages = Math.ceil(total / pageSize);
  if (total === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4 bg-black/20 p-2 rounded">
      <div className="flex items-center gap-2">
        <span className="text-sm">共 {total} 筆，每頁顯示</span>
        <select 
          value={pageSize} 
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="chalk-input bg-white text-black py-0.5 px-2 font-bold rounded"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="30">30</option>
          <option value="999">全部</option>
        </select>
        <span className="text-sm">筆</span>
      </div>
      <div className="flex gap-2">
        <button 
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
          className="chalk-btn py-1 px-3 text-sm disabled:opacity-50"
        >上一頁</button>
        <span className="text-sm self-center">第 {current} / {pages} 頁</span>
        <button 
          disabled={current === pages}
          onClick={() => onPageChange(current + 1)}
          className="chalk-btn py-1 px-3 text-sm disabled:opacity-50"
        >下一頁</button>
      </div>
    </div>
  );
}

export default function BooksManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'auto'>('list');
  
  // List Tab: Search & Pagination
  const [searchTitle, setSearchTitle] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [bookNo, setBookNo] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isBorrowed, setIsBorrowed] = useState('否');
  const [borrower, setBorrower] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // Confirm Modal State
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  // Auto Arrange State
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [academicYear, setAcademicYear] = useState('114');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('sequential');
  const [targetWeeks, setTargetWeeks] = useState(21);
  const [arrangementData, setArrangementData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'student'>('week');
  
  const [autoCurrentPage, setAutoCurrentPage] = useState(1);
  const [autoPageSize, setAutoPageSize] = useState(10);

  useEffect(() => {
    const unsubBooks = onSnapshot(collection(db, 'bear_books'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Book));
      setBooks(data);
      setSelectedBooks(prev => prev.size === 0 ? new Set(data.map(b => b.id)) : prev);
    });
    
    const unsubStudents = onSnapshot(collection(db, 'bear_students'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(data);
    });

    const unsubArr = onSnapshot(doc(db, 'bear_autoArrangements', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        setArrangementData(docSnap.data());
      }
    });

    return () => { unsubBooks(); unsubStudents(); unsubArr(); };
  }, []);

  // --- List Tab Logic ---
  const resetForm = () => {
    setEditId(null); setBookNo(''); setTitle(''); setAuthor('');
    setIsBorrowed('否'); setBorrower(''); setBorrowDate(''); setReturnDate('');
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (b: Book) => {
    setEditId(b.id); setBookNo(b.bookNo); setTitle(b.title); setAuthor(b.author || '');
    setIsBorrowed(b.isBorrowed || '否'); setBorrower(b.borrower || '');
    setBorrowDate(b.borrowDate || ''); setReturnDate(b.returnDate || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { bookNo, title, author, isBorrowed, borrower, borrowDate, returnDate };
    try {
      if (editId) await updateDoc(doc(db, 'bear_books', editId), data);
      else await addDoc(collection(db, 'bear_books'), data);
      setIsModalOpen(false);
    } catch (error) {
      alert('儲存失敗');
    }
  };

  const requestDelete = (id: string, title: string) => {
    setConfirmMessage(`確定要刪除藏書「${title}」嗎？此動作無法復原。`);
    setConfirmAction(() => async () => {
      await deleteDoc(doc(db, 'bear_books', id));
      setShowConfirm(false);
    });
    setShowConfirm(true);
  };

  const handleReturn = async (id: string) => {
    await updateDoc(doc(db, 'bear_books', id), { isBorrowed: '否', borrower: '', borrowDate: '', returnDate: '' });
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const mTitle = searchTitle ? b.title.includes(searchTitle) : true;
      const mAuthor = searchAuthor ? (b.author || '').includes(searchAuthor) : true;
      const mStatus = searchStatus ? (searchStatus === '是' ? b.isBorrowed === '是' : b.isBorrowed !== '是') : true;
      return mTitle && mAuthor && mStatus;
    }).sort((a, b) => String(a.bookNo || '').localeCompare(String(b.bookNo || ''), undefined, {numeric: true, sensitivity: 'base'}));
  }, [books, searchTitle, searchAuthor, searchStatus]);

  const pagedBooks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBooks.slice(start, start + pageSize);
  }, [filteredBooks, currentPage, pageSize]);

  // --- Auto Arrange Tab Logic ---
  const sortedAllBooks = useMemo(() => {
    return [...books].sort((a, b) => String(a.bookNo || '').localeCompare(String(b.bookNo || ''), undefined, {numeric: true, sensitivity: 'base'}));
  }, [books]);
  
  const pagedAutoBooks = useMemo(() => {
    const start = (autoCurrentPage - 1) * autoPageSize;
    return sortedAllBooks.slice(start, start + autoPageSize);
  }, [sortedAllBooks, autoCurrentPage, autoPageSize]);

  const toggleBookSelect = (id: string) => {
    const next = new Set(selectedBooks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBooks(next);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBooks(new Set(books.map(b => b.id)));
    } else {
      setSelectedBooks(new Set());
    }
  };

  const generateAutoArrange = async () => {
    const targetStudents = students
      .filter(s => s.academicYear === academicYear && (!s.status || s.status === '在學'))
      .sort((a,b) => Number(a.seatNo) - Number(b.seatNo));
      
    if (targetStudents.length === 0) {
      alert(`找不到【${academicYear}學年度】在學學生！`);
      return;
    }
    if (selectedBooks.size < targetStudents.length) {
      alert(`勾選的書籍數量 (${selectedBooks.size}) 少於學生人數 (${targetStudents.length})，請多選一些書！`);
      return;
    }

    setGenerating(true);
    let targetBooks = [...books]
      .filter(b => selectedBooks.has(b.id))
      .sort((a,b) => String(a.bookNo || '').localeCompare(String(b.bookNo || ''), undefined, {numeric: true, sensitivity: 'base'}));

    if (method === 'reverse') {
      targetBooks.reverse();
    } else if (method === 'random') {
      for (let i = targetBooks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targetBooks[i], targetBooks[j]] = [targetBooks[j], targetBooks[i]];
      }
    }

    const weeks = targetWeeks || 21;
    const weeklyArrangements = [];

    for (let w = 0; w < weeks; w++) {
      const weekItems: any[] = [];
      targetStudents.forEach((student, index) => {
        const bookIndex = (index + w) % targetBooks.length;
        const bk = targetBooks[bookIndex];
        weekItems.push({
          student: { id: student.id, seatNo: student.seatNo, name: student.name },
          book: bk ? { id: bk.id, bookNo: bk.bookNo, title: bk.title } : null
        });
      });
      weeklyArrangements.push({ weekIndex: w, items: weekItems });
    }

    try {
      await setDoc(doc(db, 'bear_autoArrangements', 'main'), {
        weeks,
        startDate,
        academicYear,
        method,
        weeklyArrangements
      });
    } catch (err) {
      alert('產生失敗');
    } finally {
      setGenerating(false);
    }
  };

  const getPrintDate = (weekIdx: number) => {
    if (!arrangementData?.startDate) return '';
    const d = new Date(arrangementData.startDate);
    d.setDate(d.getDate() + (weekIdx * 7));
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  };

    const exportAutoArrangeWord = () => {
    if (!arrangementData) return;
    const weeksData = arrangementData.weeklyArrangements;
    const studentsData = weeksData[0].items.map((it: any) => it.student);
    
    // Vertical text using <br>
    const titleChars = `${arrangementData.academicYear}班級圖書借閱登記表 小熊班`.split('');
    const verticalTitle = titleChars.map(c => c === ' ' ? '<br><br>' : c).join('<br>');

    let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>圖書借閱登記表</title>
      <style>
        body { font-family: "Microsoft JhengHei", "標楷體", sans-serif; }
        .grid-table { width: 100%; border-collapse: collapse; text-align: center; }
        .grid-table th, .grid-table td { border: 1px solid black; padding: 4px; font-size: 15px; }
        .grid-table th { background-color: #ffffff; font-weight: normal; }
        .title-table { border-collapse: collapse; width: 100%; }
        .title-table td { border: 1px solid black; text-align: center; }
        .vertical-title { font-size: 16px; padding: 4px 2px; line-height: 1.0; }
        
        /* MS Word Specific Landscape Settings */
        @page WordSection1 {
          size: 841.9pt 595.3pt; /* A4 landscape */
          mso-page-orientation: landscape;
          margin: 36.0pt 36.0pt 36.0pt 36.0pt;
        }
        div.WordSection1 { page: WordSection1; }
        /* Browser Fallback */
        @page { size: A4 landscape; margin: 1.5cm; }
      </style>
    </head>
    <body>
      <div class="WordSection1">
    `;

    for (let w = 0; w < weeksData.length; w += 2) {
      const pageBreak = w > 0 ? '<br clear="all" style="page-break-before:always; mso-break-type:page-break" />' : '';
      const w1 = weeksData[w];
      const w2 = weeksData[w + 1];
      
      const d1 = getPrintDate(w1.weekIndex);
      const d2 = w2 ? getPrintDate(w2.weekIndex) : '';

      htmlContent += `
        ${pageBreak}
        <table style="width: 100%; border: none; border-collapse: collapse; page-break-inside: avoid;">
          <tr>
            <td style="width: 50px; vertical-align: top; border: none; padding-right: 15px;">
              <table class="title-table">
                <tr>
                  <td class="vertical-title">${verticalTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 2px; height: 60px; font-size: 14px; vertical-align: top;">借<br>閱<br>日<br>期</td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: top; border: none;">
              <table class="grid-table">
                <tr>
                  <th style="width: 40px;">編<br>號</th>
                  <th>${d1} 書名</th>
                  <th style="width: 80px;">借閱者</th>
                  <th style="width: 90px;">還書日期</th>
                  ${w2 ? `
                  <th style="width: 40px;">編<br>號</th>
                  <th>${d2} 書名</th>
                  <th style="width: 80px;">借閱者</th>
                  <th style="width: 90px;">還書日期</th>
                  ` : `<th></th><th></th><th></th><th></th>`}
                </tr>
      `;

      studentsData.forEach((st: any, idx: number) => {
        const item1 = w1.items[idx];
        const item2 = w2 ? w2.items[idx] : null;

        htmlContent += `
          <tr>
            <td>${item1.book?.bookNo || ''}</td>
            <td style="text-align: left;">${item1.book?.title || ''}</td>
            <td>${st.name}</td>
            <td></td>
            ${item2 ? `
              <td>${item2.book?.bookNo || ''}</td>
              <td style="text-align: left;">${item2.book?.title || ''}</td>
              <td>${st.name}</td>
              <td></td>
            ` : `<td></td><td></td><td></td><td></td>`}
          </tr>
        `;
      });

      htmlContent += `
              </table>
            </td>
          </tr>
        </table>
      `;
    }

    htmlContent += `
      </div>
    </body>
    </html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `小熊班_借閱登記表_${arrangementData.academicYear}學年.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteArrangement = () => {
    setConfirmMessage('確定要刪除目前的借閱表結果嗎？此動作無法復原。');
    setConfirmAction(() => async () => {
      await deleteDoc(doc(db, 'bear_autoArrangements', 'main'));
      setArrangementData(null);
      setShowConfirm(false);
    });
    setShowConfirm(true);
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in space-y-6">
      <ConfirmModal 
        isOpen={showConfirm}
        title="確認刪除"
        message={confirmMessage}
        onConfirm={confirmAction || (() => {})}
        onCancel={() => setShowConfirm(false)}
        confirmText="刪除"
      />

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="chalk-box relative z-10 max-w-2xl w-full bg-[#346b4b] shadow-2xl p-6">
              <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-3">
                <h3 className="text-2xl font-bold text-yellow-300 flex items-center gap-2">
                  <PenTool className="w-6 h-6" /> {editId ? '修改藏書' : '新增藏書'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">書籍編號 *</label>
                  <input required type="text" value={bookNo} onChange={e => setBookNo(e.target.value)} className="chalk-input w-full font-bold text-yellow-100" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">書名 *</label>
                  <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="chalk-input w-full" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">作者</label>
                  <input type="text" value={author} onChange={e => setAuthor(e.target.value)} className="chalk-input w-full" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">目前狀態</label>
                  <select value={isBorrowed} onChange={e => setIsBorrowed(e.target.value)} className="chalk-input w-full text-black bg-white">
                    <option value="否">在館內</option>
                    <option value="是">已借出</option>
                  </select>
                </div>
                {isBorrowed === '是' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/20 p-3 rounded bg-black/20 mt-2">
                    <div>
                      <label className="block text-yellow-200 text-sm mb-1">借閱人 *</label>
                      <input type="text" value={borrower} onChange={e => setBorrower(e.target.value)} className="chalk-input w-full" required />
                    </div>
                    <div>
                      <label className="block text-yellow-200 text-sm mb-1">借出日期/週次 *</label>
                      <input type="text" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="chalk-input w-full" required />
                    </div>
                    <div>
                      <label className="block text-yellow-200 text-sm mb-1">預計還書日</label>
                      <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="chalk-input w-full bg-white text-black" />
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-white/20">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="chalk-btn bg-black/20 text-white/80">取消</button>
                  <button type="submit" className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold border-yellow-400">儲存</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 mb-6 border-b-2 border-white/30 pb-4">
        <button onClick={() => setActiveTab('list')} className={`chalk-btn ${activeTab === 'list' ? 'bg-white/30' : ''}`}>
          <BookOpen /> 藏書清單
        </button>
        <button onClick={() => setActiveTab('auto')} className={`chalk-btn ${activeTab === 'auto' ? 'bg-white/30' : ''}`}>
          <CheckSquare /> 藏書租借自動安排
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="chalk-box bg-black/20 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-yellow-200 text-sm mb-1">書名查詢</label>
              <input type="text" value={searchTitle} onChange={e => { setSearchTitle(e.target.value); setCurrentPage(1); }} className="chalk-input w-full" placeholder="輸入書名關鍵字..." />
            </div>
            <div className="flex-1">
              <label className="block text-yellow-200 text-sm mb-1">作者查詢</label>
              <input type="text" value={searchAuthor} onChange={e => { setSearchAuthor(e.target.value); setCurrentPage(1); }} className="chalk-input w-full" placeholder="輸入作者關鍵字..." />
            </div>
            <div className="flex-1">
              <label className="block text-yellow-200 text-sm mb-1">狀態</label>
              <select value={searchStatus} onChange={e => { setSearchStatus(e.target.value); setCurrentPage(1); }} className="chalk-input w-full text-black bg-white">
                <option value="">全部</option>
                <option value="否">在館內</option>
                <option value="是">已借出</option>
              </select>
            </div>
            <button onClick={openAddModal} className="chalk-btn bg-yellow-600 hover:bg-yellow-500 flex items-center gap-2 px-6 shadow-lg shadow-yellow-500/20">
              <PlusCircle className="w-5 h-5" /> 新增書籍
            </button>
          </div>

          <div className="chalk-box overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
               藏書清單
              <span className="text-sm font-normal bg-black/30 px-3 py-1 rounded-full shadow-inner ml-2">
                總館藏: <span className="font-bold text-yellow-300">{books.length}</span> 本 | 符合條件: <span className="font-bold text-yellow-300">{filteredBooks.length}</span> 筆
              </span>
            </h2>
            <div className="mb-4">
              <Pagination 
                total={filteredBooks.length} 
                current={currentPage} 
                pageSize={pageSize} 
                onPageChange={setCurrentPage} 
                onPageSizeChange={setPageSize} 
              />
            </div>
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-white/50 bg-black/20">
                  <th className="p-3 w-20 text-center text-yellow-100">編號</th>
                  <th className="p-3">書名</th>
                  <th className="p-3 w-40">作者</th>
                  <th className="p-3 w-32">狀態</th>
                  <th className="p-3 w-32 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedBooks.map(b => (
                  <tr key={b.id} className="border-b border-white/20 hover:bg-white/10">
                    <td className="p-3 text-center font-bold text-yellow-200">{b.bookNo}</td>
                    <td className="p-3 font-bold">{b.title}</td>
                    <td className="p-3 text-sm text-gray-300">{b.author}</td>
                    <td className="p-3">
                      {b.isBorrowed === '是' ? (
                        <div className="text-red-400 text-sm font-bold">
                          已借出<br/><span className="text-xs font-normal text-red-300">{b.borrower}</span>
                        </div>
                      ) : (
                        <span className="text-green-400 font-bold">在館內</span>
                      )}
                    </td>
                    <td className="p-3 flex justify-center gap-2">
                      {b.isBorrowed === '是' && <button onClick={() => handleReturn(b.id)} className="bg-green-600/70 hover:bg-green-500 px-2 py-1 rounded text-xs border border-green-400 shadow">歸還</button>}
                      <button onClick={() => openEditModal(b)} className="text-yellow-300 hover:text-yellow-100 p-1 bg-black/20 rounded"><PenTool className="w-4 h-4" /></button>
                      <button onClick={() => requestDelete(b.id, b.title)} className="text-red-400 hover:text-red-200 p-1 bg-black/20 rounded"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <Pagination 
              total={filteredBooks.length} 
              current={currentPage} 
              pageSize={pageSize} 
              onPageChange={setCurrentPage} 
              onPageSizeChange={setPageSize} 
            />
          </div>
        </div>
      )}

      {activeTab === 'auto' && (
        <div className="space-y-6">
          <div className="chalk-box bg-[#346b4b] border-yellow-400 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Settings className="w-6 h-6" /> 產生借閱表設定</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-yellow-200 mb-2">1. 選擇學年度 (學生)</label>
                <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="chalk-input w-full bg-white text-black font-bold">
                  {['112', '113', '114', '115'].map(y => <option key={y} value={y}>{y}學年</option>)}
                </select>
              </div>
              <div>
                <label className="block text-yellow-200 mb-2">2. 設定開始日期 (W1)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="chalk-input w-full bg-white text-black font-bold" />
              </div>
              <div>
                <label className="block text-yellow-200 mb-2">3. 分配方式</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="chalk-input w-full bg-white text-black font-bold">
                  <option value="sequential">依書籍編號順序輪替</option>
                  <option value="random">隨機打亂書單輪替</option>
                  <option value="reverse">依書籍編號反向輪替</option>
                </select>
              </div>
              <div>
                <label className="block text-yellow-200 mb-2">4. 產生的週次數量</label>
                <input type="number" min="1" max="50" value={targetWeeks} onChange={e => setTargetWeeks(Number(e.target.value))} className="chalk-input w-full font-bold" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-yellow-200 mb-2 font-bold text-lg">
                5. 勾選欲參與輪替的書籍 ({selectedBooks.size} / {books.length})
              </label>
              <div className="mb-2">
                <Pagination 
                  total={books.length} 
                  current={autoCurrentPage} 
                  pageSize={autoPageSize} 
                  onPageChange={setAutoCurrentPage} 
                  onPageSizeChange={setAutoPageSize} 
                />
              </div>
              <div className="border border-white/20 rounded bg-black/20 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/20">
                      <th className="p-2 w-20 text-center">
                        <label className="flex items-center justify-center gap-1 cursor-pointer hover:text-yellow-300">
                          <input 
                            type="checkbox" 
                            checked={selectedBooks.size === books.length && books.length > 0} 
                            onChange={(e) => handleSelectAll(e.target.checked)} 
                            className="w-4 h-4 accent-yellow-500" 
                          />
                          <span className="text-xs">全選</span>
                        </label>
                      </th>
                      <th className="p-2 w-24">編號</th>
                      <th className="p-2">書名</th>
                      <th className="p-2 text-sm text-gray-300">作者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAutoBooks.map(b => (
                      <tr key={b.id} className="border-b border-white/10 hover:bg-white/5 cursor-pointer" onClick={() => toggleBookSelect(b.id)}>
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={selectedBooks.has(b.id)} readOnly className="w-4 h-4 accent-yellow-500 pointer-events-none" />
                        </td>
                        <td className="p-2 font-bold text-yellow-200">{b.bookNo}</td>
                        <td className="p-2">{b.title}</td>
                        <td className="p-2 text-sm text-gray-400">{b.author}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4">
                  <Pagination 
                    total={books.length} 
                    current={autoCurrentPage} 
                    pageSize={autoPageSize} 
                    onPageChange={setAutoCurrentPage} 
                    onPageSizeChange={setAutoPageSize} 
                  />
                </div>
              </div>
            </div>

            <button onClick={generateAutoArrange} disabled={generating} className="chalk-btn w-full justify-center bg-yellow-600 shadow-lg text-lg py-3">
              {generating ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckSquare className="w-6 h-6" />}
              產生 {targetWeeks} 週每週借閱表
            </button>
          </div>

          {arrangementData && (
            <div className="chalk-box">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-white/20 pb-4">
                <h2 className="text-2xl font-bold text-yellow-300 flex items-center gap-2">
                  借閱表結果 <span className="text-lg text-white">({arrangementData.academicYear}學年)</span>
                </h2>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button onClick={() => setViewMode('week')} className={`chalk-btn text-sm ${viewMode === 'week' ? 'bg-yellow-600 border-yellow-400 font-bold' : 'bg-black/30'}`}>依週次檢視</button>
                  <button onClick={() => setViewMode('student')} className={`chalk-btn text-sm ${viewMode === 'student' ? 'bg-yellow-600 border-yellow-400 font-bold' : 'bg-black/30'}`}>依學生檢視</button>
                  <button onClick={exportAutoArrangeWord} className="chalk-btn text-sm bg-blue-600/70 hover:bg-blue-500 shadow-lg border-blue-400 flex items-center gap-1">
                    <Printer className="w-4 h-4" /> 匯出為 Word
                  </button>
                  <button onClick={handleDeleteArrangement} className="chalk-btn text-sm bg-red-600/70 hover:bg-red-500 shadow-lg border-red-400 flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> 刪除結果
                  </button>
                </div>
              </div>

              {viewMode === 'week' ? (
                <div className="space-y-6">
                  {arrangementData.weeklyArrangements.map((w: any) => (
                    <div key={w.weekIndex} className="bg-black/20 p-4 rounded-lg border border-white/20 hover:bg-black/30 transition-colors">
                      <h3 className="font-bold text-yellow-300 text-lg mb-3 flex items-center gap-2">
                        第 {w.weekIndex + 1} 週 
                        <span className="text-sm bg-white/10 px-2 py-0.5 rounded-full text-white">借閱日: {getPrintDate(w.weekIndex)}</span>
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {w.items.map((it: any, i: number) => (
                          <div key={i} className="bg-white/5 p-2 rounded border border-white/10 text-sm flex flex-col hover:border-yellow-500/50 transition-colors">
                            <span className="font-bold text-white mb-1 border-b border-white/10 pb-1">{it.student.seatNo}號 {it.student.name}</span>
                            <span className="text-yellow-100 opacity-90 mt-1 truncate" title={it.book?.title}>[{it.book?.bookNo || '-'}] {it.book?.title || '無'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {arrangementData.weeklyArrangements[0]?.items.map((it: any, studentIdx: number) => (
                    <div key={studentIdx} className="bg-black/20 p-4 rounded-lg border border-white/20 hover:bg-black/30 transition-colors">
                      <h3 className="font-bold text-yellow-300 text-lg mb-3 border-b border-white/10 pb-2">👤 {it.student.seatNo}號 {it.student.name}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {arrangementData.weeklyArrangements.map((w: any) => {
                          const studentItem = w.items[studentIdx];
                          return (
                            <div key={w.weekIndex} className="bg-white/5 p-2 rounded border border-white/10 text-xs flex flex-col hover:border-yellow-500/50 transition-colors">
                              <span className="font-bold text-white/50 mb-1 border-b border-white/10 pb-1">W{w.weekIndex + 1} ({getPrintDate(w.weekIndex)})</span>
                              <span className="text-yellow-100 opacity-90 mt-1 line-clamp-2" title={studentItem.book?.title}>[{studentItem.book?.bookNo || '-'}] {studentItem.book?.title || '無'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
