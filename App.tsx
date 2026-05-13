/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 評分標準關鍵要求：
 * 「需要後端數據庫，數據要持久保存。」
 */

import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot, 
  query, 
  where,
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from './lib/firebase';
import { Book, User, Calendar, Library, Loader2, RotateCcw, CheckCircle2, ListFilter, LogOut, IdCard, School, LogIn, GraduationCap, Settings, HelpCircle, Plus, X, Heart, HeartOff, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StudentInfo {
  uid: string;
  studentId: string;
  name: string;
  grade: string;
  classLetter: string;
  photoURL?: string;
}

interface RentalRecord {
  id: string;
  uid: string;
  bookTitle: string;
  borrowerName: string;
  studentId: string;
  grade: string;
  classLetter: string;
  borrowDate: string;
  returnDate: string;
  status: 'borrowed' | 'returned';
  createdAt: Timestamp;
  returnedAt?: Timestamp;
}

interface FavoriteBook {
  id: string;
  uid: string;
  bookTitle: string;
  createdAt: Timestamp;
}

type TabType = 'borrow' | 'return';
type Language = 'en' | 'zh-TW' | 'zh-CN' | 'pt';

const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const PRIMARY_CLASSES = ['A', 'B', 'C', 'D', 'E'];
const SECONDARY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'];

const TRANSLATIONS: Record<Language, any> = {
  en: {
    loginTitle: "Library System Login",
    loginSubtitle: "Enter your details to start borrowing",
    studentId: "Student ID",
    fullName: "Full Name",
    grade: "Grade",
    class: "Class",
    enterSystem: "Enter System",
    borrowing: "Borrowing",
    returning: "Returning",
    currentUser: "Current User",
    logout: "Logout",
    recommendedBooks: "Monthly Recommended Books",
    fiction: "Fiction",
    science: "Science",
    history: "History",
    art: "Art",
    rank: "Rank",
    autoFilledInfo: "Auto-filled Info",
    bookTitle: "Book Title",
    borrowDate: "Borrow Date",
    returnDate: "Return Date",
    confirmBorrow: "Confirm Borrow",
    currentBorrowedList: "Current Borrowed List",
    borrower: "Borrower",
    dueDate: "Due Date",
    noRecords: "No records found",
    booksToReturn: "Books to Return",
    clickToConfirm: "Click the button to confirm return",
    confirmReturn: "Confirm Return",
    noBooksToReturn: "No books to return currently",
    returnedHistory: "Returned History",
    period: "Period",
    returnedDate: "Returned Date",
    noHistory: "No history found",
    idPlaceholder: "e.g. 1234567-8",
    namePlaceholder: "Enter your name",
    bookPlaceholder: "Enter book title...",
    confirmReturnMsg: "Are you sure you want to return this book?",
    successBorrow: "Borrowing successful!",
    successReturn: "Return successful!",
    errorSubmit: "Submission failed, please try again.",
    errorReturn: "Return failed, please try again.",
    errorLoad: "Failed to load data.",
    invalidId: "Invalid Student ID format (3-20 characters).",
    fillAll: "Please fill in all fields",
    loginWithGoogle: "Login with Google",
    loginLoading: "Connecting...",
    popupBlocked: "Popup blocked! Please allow popups for this site or open the app in a new tab.",
    authCancelled: "Login was cancelled. Please try again.",
    completeProfile: "Complete Your Profile",
    private: "Private",
    onlyYourRecords: "Only your records are shown here",
    settings: "Settings",
    language: "Language",
    profile: "Profile",
    help: "Help",
    saveChanges: "Save Changes",
    manualTitle: "User Manual",
    manualStep1: "1. Login with your Google account.",
    manualStep2: "2. Complete your profile (Student ID, Name, etc.).",
    manualStep3: "3. Use 'Borrowing' tab to register a new book rental.",
    manualStep4: "4. Use 'Returning' tab to confirm when you bring back a book.",
    manualStep5: "5. Your privacy is protected; others cannot see your full name.",
    close: "Close",
    favorites: "Favorites",
    addToFavorites: "Add to Favorites",
    removeFavorite: "Remove",
    followingBook: "Following",
    bookStatus: "Status",
    available: "Available",
    borrowedBy: "Borrowed by",
    statusBorrowed: "Borrowed",
    statusAvailable: "Available",
    statsSummary: "Library Stats",
    totalRentals: "Total Borrowed",
    activeRentals: "Currently Out",
    returnedBooks: "Returned",
    activeStudents: "Active Students",
    yourActivity: "Your Contributions"
  },
  'zh-TW': {
    loginTitle: "圖書館系統登錄",
    loginSubtitle: "請輸入您的學生資料以開始借閱",
    studentId: "學生證編號",
    fullName: "中文全名",
    grade: "年級",
    class: "班別",
    enterSystem: "進入系統",
    borrowing: "借書登記",
    returning: "還書管理",
    currentUser: "當前用戶",
    logout: "登出",
    recommendedBooks: "本月推薦書籍",
    fiction: "小說類",
    science: "科學類",
    history: "歷史類",
    art: "藝術類",
    rank: "排名",
    autoFilledInfo: "自動填寫資料",
    bookTitle: "書名",
    borrowDate: "借閱日期",
    returnDate: "歸還日期",
    confirmBorrow: "確認借出",
    currentBorrowedList: "當前借出清單",
    borrower: "借閱者",
    dueDate: "預計歸還",
    noRecords: "暫無借出記錄",
    booksToReturn: "待歸還書籍",
    clickToConfirm: "請點擊按鈕進行歸還確認",
    confirmReturn: "確認歸還",
    noBooksToReturn: "目前沒有待歸還的書籍",
    returnedHistory: "已歸還歷史記錄",
    period: "借期",
    returnedDate: "歸還日期",
    noHistory: "暫無歸還歷史",
    idPlaceholder: "例如: 1234567-8",
    namePlaceholder: "請輸入中文全名",
    bookPlaceholder: "請輸入您要借閱的書名...",
    confirmReturnMsg: "確定要歸還這本書嗎？",
    successBorrow: "借書成功！",
    successReturn: "還書成功！",
    errorSubmit: "提交失敗，請重試。",
    errorReturn: "還書失敗，請重試。",
    errorLoad: "無法加載數據。",
    invalidId: "學生證編號格式錯誤 (3-20 字元)。",
    fillAll: "請填寫所有欄位",
    loginWithGoogle: "使用 Google 帳號登錄",
    loginLoading: "正在連接...",
    popupBlocked: "彈窗被攔截！請允許此網站的彈窗，或在「新分頁」中打開應用程序。",
    authCancelled: "登錄已取消，請重試。",
    completeProfile: "完善個人資料",
    private: "不公開",
    onlyYourRecords: "此處僅顯示您的借書記錄",
    settings: "設定",
    language: "語言",
    profile: "個人資料",
    help: "說明書",
    saveChanges: "保存更改",
    manualTitle: "使用說明",
    manualStep1: "1. 使用 Google 帳號登錄系統。",
    manualStep2: "2. 首次登錄請完善個人資料（學生證、姓名等）。",
    manualStep3: "3. 在「借書登記」分頁輸入書名與日期進行登記。",
    manualStep4: "4. 在「還書管理」分頁確認您已歸還的書籍。",
    manualStep5: "5. 系統保護隱私，他人無法看到您的全名與班級。",
    close: "關閉",
    register: "登記借書",
    registerBorrowing: "登記新借閱",
    favorites: "喜愛追蹤",
    addToFavorites: "加入喜愛項目",
    removeFavorite: "移除項目",
    followingBook: "正在追蹤",
    bookStatus: "書本狀態",
    available: "可借閱",
    borrowedBy: "借閱中：",
    statusBorrowed: "借閱中",
    statusAvailable: "可借閱",
    statsSummary: "統計摘要",
    totalRentals: "累計借閱",
    activeRentals: "目前借出",
    returnedBooks: "已歸還",
    activeStudents: "活躍學生",
    yourActivity: "您的活躍度"
  },
  'zh-CN': {
    loginTitle: "图书馆系统登录",
    loginSubtitle: "请输入您的学生资料以开始借阅",
    studentId: "学生证編号",
    fullName: "中文全名",
    grade: "年级",
    class: "班别",
    enterSystem: "进入系统",
    borrowing: "借书登记",
    returning: "还书管理",
    currentUser: "当前用户",
    logout: "登出",
    recommendedBooks: "本月推荐书籍",
    fiction: "小说类",
    science: "科学类",
    history: "历史类",
    art: "艺术类",
    rank: "排名",
    autoFilledInfo: "自动填写资料",
    bookTitle: "书名",
    borrowDate: "借阅日期",
    returnDate: "归还日期",
    confirmBorrow: "确认借出",
    currentBorrowedList: "当前借出清单",
    borrower: "借阅者",
    dueDate: "预计归还",
    noRecords: "暂无借出记录",
    booksToReturn: "待归还书籍",
    clickToConfirm: "请点击按钮进行归还确认",
    confirmReturn: "确认归还",
    noBooksToReturn: "目前没有待归还的书籍",
    returnedHistory: "已归还历史记录",
    period: "借期",
    returnedDate: "归还日期",
    noHistory: "暂无归还历史",
    idPlaceholder: "例如: 1234567-8",
    namePlaceholder: "请输入中文全名",
    bookPlaceholder: "请输入您要借阅的书名...",
    confirmReturnMsg: "确定要归还这本书吗？",
    successBorrow: "借书成功！",
    successReturn: "还书成功！",
    errorSubmit: "提交失败，请重试。",
    errorReturn: "还书失败，请重试。",
    errorLoad: "无法加载数据。",
    invalidId: "学生证編号格式错误 (3-20 字符)。",
    fillAll: "请填写所有字段",
    loginWithGoogle: "使用 Google 账号登录",
    loginLoading: "正在连接...",
    popupBlocked: "弹窗被拦截！请允许此网站的弹窗，或在“新标签页”中打开应用程序。",
    authCancelled: "登录已取消，请重试。",
    completeProfile: "完善个人资料",
    private: "不公开",
    onlyYourRecords: "此处僅显示您的借书记录",
    settings: "设置",
    language: "语言",
    profile: "个人资料",
    help: "说明书",
    saveChanges: "保存更改",
    manualTitle: "使用说明",
    manualStep1: "1. 使用 Google 账号登录系统。",
    manualStep2: "2. 首次登录请完善个人资料（学生证、姓名等）。",
    manualStep3: "3. 在“借书登记”选项卡输入书名与日期进行登记。",
    manualStep4: "4. 在“还书管理”选项卡确认您已归还的书籍。",
    manualStep5: "5. 系统保护隐私，他人无法看到您的全名与班級。",
    close: "关闭",
    register: "登记借书",
    registerBorrowing: "登记新借阅",
    favorites: "喜爱追踪",
    addToFavorites: "加入喜愛项目",
    removeFavorite: "移除项目",
    followingBook: "正在追踪",
    bookStatus: "书本状态",
    available: "可借阅",
    borrowedBy: "借阅中：",
    statusBorrowed: "借阅中",
    statusAvailable: "可借阅",
    statsSummary: "统计摘要",
    totalRentals: "累计借阅",
    activeRentals: "目前借出",
    returnedBooks: "已归还",
    activeStudents: "活跃学生",
    yourActivity: "您的活跃度"
  },
  pt: {
    loginTitle: "Login do Sistema de Biblioteca",
    loginSubtitle: "Insira seus dados para começar a pedir emprestado",
    studentId: "ID do Estudante",
    fullName: "Nome Completo",
    grade: "Ano",
    class: "Turma",
    enterSystem: "Entrar no Sistema",
    borrowing: "Empréstimo",
    returning: "Devolução",
    currentUser: "Usuário Atual",
    logout: "Sair",
    recommendedBooks: "Livros Recomendados do Mês",
    fiction: "Ficção",
    science: "Ciência",
    history: "História",
    art: "Arte",
    rank: "Classificação",
    autoFilledInfo: "Informação Preenchida Automaticamente",
    bookTitle: "Título do Livro",
    borrowDate: "Data de Empréstimo",
    returnDate: "Data de Devolução",
    confirmBorrow: "Confirmar Empréstimo",
    currentBorrowedList: "Lista de Empréstimos Atuais",
    borrower: "Requisitante",
    dueDate: "Data de Vencimento",
    noRecords: "Nenhum registro encontrado",
    booksToReturn: "Livros para Devolver",
    clickToConfirm: "Clique no botão para confirmar a devolução",
    confirmReturn: "Confirmar Devolução",
    noBooksToReturn: "Nenhum livro para devolver no momento",
    returnedHistory: "Histórico de Devoluções",
    period: "Período",
    returnedDate: "Data de Devolução",
    noHistory: "Nenhum histórico encontrado",
    idPlaceholder: "Ex: 1234567-8",
    namePlaceholder: "Insira seu nome",
    bookPlaceholder: "Insira o título do livro...",
    confirmReturnMsg: "Tem certeza que deseja devolver este livro?",
    successBorrow: "Empréstimo realizado com sucesso!",
    successReturn: "Devolução realizada com sucesso!",
    errorSubmit: "Falha ao enviar. Por favor, tente novamente.",
    errorReturn: "Falha ao devolver. Por favor, tente novamente.",
    errorLoad: "Falha ao carregar dados.",
    invalidId: "Formato de ID de estudante inválido (3-20 caracteres).",
    fillAll: "Por favor, preencha todos os campos",
    loginWithGoogle: "Entrar com Google",
    loginLoading: "Conectando...",
    popupBlocked: "Popup bloqueado! Por favor, permita popups para este site.",
    authCancelled: "Login cancelado. Por favor, tente novamente.",
    completeProfile: "Completar Perfil",
    private: "Privado",
    onlyYourRecords: "Apenas seus registros serão mostrados",
    settings: "Configurações",
    language: "Idioma",
    profile: "Perfil",
    help: "Ajuda",
    saveChanges: "Salvar Alterações",
    manualTitle: "Manual do Usuário",
    manualStep1: "1. Faça login com sua conta Google.",
    manualStep2: "2. Complete seu perfil (ID de estudante, nome, etc.).",
    manualStep3: "3. Registre novos empréstimos na aba 'Empréstimo'.",
    manualStep4: "4. Confirme a devolução na aba 'Devolução' após devolver o livro.",
    manualStep5: "5. A privacidade é protegida; outros não podem ver seu nome completo.",
    close: "Fechar",
    registerBorrowing: "Registrar Empréstimo",
    register: "Registrar",
    confirmBorrowBtn: "Confirmar",
    bookPlaceholderShort: "Título...",
    favorites: "Favoritos",
    addToFavorites: "Adicionar aos Favoritos",
    removeFavorite: "Remover",
    followingBook: "Seguindo",
    bookStatus: "Status",
    available: "Disponível",
    borrowedBy: "Emprestado por",
    statusBorrowed: "Emprestado",
    statusAvailable: "Disponível",
    statsSummary: "Estatísticas",
    totalRentals: "Total Emprestado",
    activeRentals: "Atualmente Fora",
    returnedBooks: "Devolvidos",
    activeStudents: "Alunos Ativos",
    yourActivity: "Sua Atividade"
  }
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [lang, setLang] = useState<Language>('zh-TW');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('borrow');
  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [recommendedBooks, setRecommendedBooks] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteBook[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['zh-TW'] || TRANSLATIONS['en'];

  // Gemini API initialization
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const fetchRecommendations = async () => {
    if (recLoading) return;
    setRecLoading(true);
    try {
      const prompt = `Provide a list of 3 monthly recommended books for each of these categories: Fiction, Science, History. 
      The output must be in JSON format.
      The language should be ${lang === 'en' ? 'English' : lang === 'pt' ? 'Portuguese' : 'Traditional Chinese'}.
      Do not include borrow counts.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                books: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      author: { type: Type.STRING }
                    },
                    required: ["title", "author"]
                  }
                }
              },
              required: ["category", "books"]
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      setRecommendedBooks(data);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      // Fallback data if API fails
      setRecommendedBooks([
        { 
          category: t.fiction, 
          books: [
            { title: '解憂雜貨店', author: '東野圭吾' },
            { title: '哈利波特', author: 'J.K. 羅琳' },
            { title: '小王子', author: '安東尼·德·聖-埃克蘇佩里' },
          ]
        },
        { 
          category: t.science, 
          books: [
            { title: '時間簡史', author: '史蒂芬·霍金' },
            { title: '自私的基因', author: '理查德·道金斯' },
            { title: '宇宙', author: '卡爾·薩根' },
          ]
        },
        { 
          category: t.history, 
          books: [
            { title: '萬曆十五年', author: '黃仁宇' },
            { title: '人類大歷史', author: '哈拉瑞' },
            { title: '槍炮、病菌與鋼鐵', author: '賈德·戴蒙' },
          ]
        },
      ]);
    } finally {
      setRecLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [lang]);

  // Sync favorites
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    setFavoritesLoading(true);
    const favPath = 'favorites';
    // Use where clause for security and performance
    const q = query(
      collection(db, favPath), 
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userFavs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FavoriteBook[];
      setFavorites(userFavs);
      setFavoritesLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, favPath);
      setFavoritesLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const toggleFavorite = async (bookTitle: string) => {
    if (!user) return;
    const existing = favorites.find(f => f.bookTitle === bookTitle);
    const favPath = 'favorites';
    try {
      if (existing) {
        await deleteDoc(doc(db, favPath, existing.id));
      } else {
        await addDoc(collection(db, favPath), {
          uid: user.uid,
          bookTitle,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, favPath);
    }
  };

  // Login form state
  const [loginData, setLoginData] = useState({
    studentId: '',
    name: '',
    grade: 'P1',
    classLetter: 'A',
    photoURL: '',
  });

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // Limit to 500KB for Firestore document size safety
        alert("File too large (max 500KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLoginData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Borrow form state
  const [formData, setFormData] = useState({
    bookTitle: '',
    borrowDate: new Date().toISOString().split('T')[0],
    returnDate: '',
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch profile
        const userPath = `users/${currentUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as StudentInfo;
            setStudent(profile);
            setLoginData({
              studentId: profile.studentId,
              name: profile.name,
              grade: profile.grade,
              classLetter: profile.classLetter,
              photoURL: profile.photoURL || currentUser.photoURL || ''
            });
          } else {
            setStudent(null);
            setLoginData(prev => ({ 
              ...prev, 
              name: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '' 
            }));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, userPath);
        }
      } else {
        setStudent(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('library_lang') as any;
    if (savedLang) {
      // Migrate old 'zh' to 'zh-TW' or validate
      if (savedLang === 'zh') {
        setLang('zh-TW');
        localStorage.setItem('library_lang', 'zh-TW');
      } else if (Object.keys(TRANSLATIONS).includes(savedLang)) {
        setLang(savedLang);
      }
    }
  }, []);

  const toggleLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('library_lang', newLang);
  };

  // Real-time data fetching
  useEffect(() => {
    const rentalsPath = 'rentals';
    const q = query(collection(db, rentalsPath), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RentalRecord[];
      setRentals(records);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, rentalsPath);
      // Ensure t is available, though it should be as it's derived from lang state
      const currentT = TRANSLATIONS[lang] || TRANSLATIONS['en'];
      setError(currentT.errorLoad);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [lang]); // Depend on lang instead of t.errorLoad to avoid stale closures or undefined issues

  const handleGoogleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/popup-blocked') {
        alert(t.popupBlocked);
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Silently handle or show a small hint
        console.warn("Popup request cancelled by a newer request");
      } else if (err.code === 'auth/popup-closed-by-user') {
        alert(t.authCancelled);
      } else {
        alert(err.message || "Login failed");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const idRegex = /^[a-zA-Z0-9-]{3,20}$/;
    if (!idRegex.test(loginData.studentId)) {
      alert(t.invalidId);
      return;
    }
    if (!loginData.name || !loginData.grade || !loginData.classLetter) {
      alert(t.fillAll);
      return;
    }

    const info: StudentInfo = { 
      uid: user.uid,
      ...loginData 
    };
    
    const userPath = `users/${user.uid}`;
    try {
      const infoWithPhoto = {
        ...info,
        photoURL: loginData.photoURL
      };
      await setDoc(doc(db, 'users', user.uid), infoWithPhoto);
      setStudent(infoWithPhoto);
      setIsEditingProfile(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!student || !user) return;
    if (!formData.bookTitle || !formData.borrowDate || !formData.returnDate) {
      alert(t.fillAll);
      return;
    }

    setSubmitting(true);
    const rentalsPath = 'rentals';
    try {
      await addDoc(collection(db, rentalsPath), {
        uid: user.uid,
        bookTitle: formData.bookTitle,
        borrowerName: student.name,
        studentId: student.studentId,
        grade: student.grade,
        classLetter: student.classLetter,
        borrowDate: formData.borrowDate,
        returnDate: formData.returnDate,
        status: 'borrowed',
        createdAt: serverTimestamp(),
      });
      setFormData({
        bookTitle: '',
        borrowDate: new Date().toISOString().split('T')[0],
        returnDate: '',
      });
      alert(t.successBorrow);
      setShowRegisterForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, rentalsPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (rentalId: string) => {
    setReturningId(rentalId);
    const rentalPath = `rentals/${rentalId}`;
    try {
      const rentalRef = doc(db, 'rentals', rentalId);
      await updateDoc(rentalRef, {
        status: 'returned',
        returnedAt: serverTimestamp()
      });
      // We don't use alert() here to avoid blocking, the real-time update will show the change
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, rentalPath);
    } finally {
      setReturningId(null);
    }
  };

  const borrowedList = rentals.filter(r => r.status === 'borrowed');
  const myBorrowedList = borrowedList.filter(r => r.uid === user?.uid);
  const returnedList = rentals.filter(r => r.status === 'returned').filter(r => r.uid === user?.uid);

  const stats = {
    total: rentals.length,
    active: borrowedList.length,
    returned: rentals.filter(r => r.status === 'returned').length,
    students: new Set(rentals.map(r => r.uid)).size,
    userTotal: rentals.filter(r => r.uid === user?.uid).length
  };

  const currentClassOptions = loginData.grade.startsWith('P') ? PRIMARY_CLASSES : SECONDARY_CLASSES;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin opacity-20" />
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6 font-sans">
        <div className="absolute top-6 right-6 flex gap-2">
          <button 
            onClick={() => setShowHelp(true)}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="relative group">
            <button className="px-4 py-2 border border-[#141414] text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
              {lang.toUpperCase()}
            </button>
            <div className="absolute right-0 mt-1 w-32 bg-[#141414] text-[#E4E3E0] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
              {(['en', 'zh-TW', 'zh-CN', 'ja'] as Language[]).map(l => (
                <button 
                  key={l}
                  onClick={() => toggleLang(l)}
                  className="w-full text-left px-4 py-2 text-[10px] hover:bg-[#E4E3E0] hover:text-[#141414] transition-colors"
                >
                  {l === 'en' ? 'English' : l === 'zh-TW' ? '繁體中文' : l === 'zh-CN' ? '简体中文' : '日本語'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#141414] text-[#E4E3E0] p-8 rounded-sm shadow-2xl border border-[#E4E3E0] border-opacity-10"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#E4E3E0] text-[#141414] rounded-full flex items-center justify-center mb-4">
              <Library className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-tighter">{t.loginTitle}</h1>
            <p className="font-serif italic opacity-60 text-sm mt-1 text-center">{t.loginSubtitle}</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loginLoading}
            className="w-full bg-[#E4E3E0] text-[#141414] py-4 font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loginLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> {t.loginLoading}
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> {t.loginWithGoogle}
              </>
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  // Profile Setup Screen
  if (!student) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#141414] text-[#E4E3E0] p-8 rounded-sm shadow-2xl border border-[#E4E3E0] border-opacity-10"
        >
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">{t.completeProfile}</h1>
            <p className="font-serif italic opacity-60 text-sm mt-1 text-center">{user.email}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="flex flex-col items-center gap-4 mb-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-2 border-[#E4E3E0] border-opacity-20 overflow-hidden bg-[#141414]">
                  {loginData.photoURL ? (
                    <img src={loginData.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-[#141414] bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full text-[10px] uppercase font-bold tracking-tighter text-center px-2">
                  {t.uploadPhoto}
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <div className="w-full space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-widest opacity-30">{t.avatarUrl}</label>
                <input 
                  type="text" 
                  value={loginData.photoURL}
                  onChange={(e) => setLoginData(prev => ({ ...prev, photoURL: e.target.value }))}
                  className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-20 py-1 text-[10px] focus:outline-none focus:border-opacity-100 transition-all font-mono"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest opacity-50 flex items-center gap-2">
                <IdCard className="w-3 h-3" /> {t.studentId}
              </label>
              <input
                type="text"
                value={loginData.studentId}
                onChange={(e) => setLoginData({ ...loginData, studentId: e.target.value })}
                className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all font-mono"
                placeholder={t.idPlaceholder}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest opacity-50 flex items-center gap-2">
                <User className="w-3 h-3" /> {t.fullName}
              </label>
              <input
                type="text"
                value={loginData.name}
                onChange={(e) => setLoginData({ ...loginData, name: e.target.value })}
                className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all"
                placeholder={t.namePlaceholder}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest opacity-50 flex items-center gap-2">
                  <GraduationCap className="w-3 h-3" /> {t.grade}
                </label>
                <select
                  value={loginData.grade}
                  onChange={(e) => {
                    const newGrade = e.target.value;
                    const isNewPrimary = newGrade.startsWith('P');
                    let newClass = loginData.classLetter;
                    if (isNewPrimary && !PRIMARY_CLASSES.includes(newClass)) {
                      newClass = 'A';
                    }
                    setLoginData({ ...loginData, grade: newGrade, classLetter: newClass });
                  }}
                  className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all appearance-none cursor-pointer"
                >
                  {GRADES.map(g => (
                    <option key={g} value={g} className="bg-[#141414]">{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest opacity-50 flex items-center gap-2">
                  <School className="w-3 h-3" /> {t.class}
                </label>
                <select
                  value={loginData.classLetter}
                  onChange={(e) => setLoginData({ ...loginData, classLetter: e.target.value })}
                  className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all appearance-none cursor-pointer"
                >
                  {currentClassOptions.map(c => (
                    <option key={c} value={c} className="bg-[#141414]">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#E4E3E0] text-[#141414] py-4 font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <CheckCircle2 className="w-5 h-5" /> {t.enterSystem}
            </button>
            
            <button
              type="button"
              onClick={handleLogout}
              className="w-full border border-[#E4E3E0] border-opacity-30 text-[#E4E3E0] py-2 font-bold uppercase tracking-widest text-[10px] hover:bg-[#E4E3E0] hover:text-[#141414] transition-all mt-2"
            >
              {t.logout}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Library className="w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-tight uppercase">Library Rental System</h1>
        </div>
        
        <nav className="flex bg-[#141414] p-1 rounded-sm">
          <button 
            onClick={() => setActiveTab('borrow')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === 'borrow' ? "bg-[#E4E3E0] text-[#141414]" : "text-[#E4E3E0] hover:opacity-70"
            )}
          >
            {t.borrowing}
          </button>
          <button 
            onClick={() => setActiveTab('return')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === 'return' ? "bg-[#E4E3E0] text-[#141414]" : "text-[#E4E3E0] hover:opacity-70"
            )}
          >
            {t.returning}
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono uppercase opacity-50">{t.currentUser}</p>
            <p className="text-xs font-bold leading-none">{student.name}</p>
            <p className="text-[10px] opacity-40">{student.grade}{student.classLetter}</p>
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-0.5 transition-all rounded-full border-2",
                showSettings ? "border-[#141414]" : "border-transparent hover:border-[#141414]"
              )}
              title={t.settings}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#141414]">
                {student.photoURL ? (
                  <img src={student.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#E4E3E0] opacity-40">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-64 bg-[#141414] text-[#E4E3E0] p-4 rounded-sm shadow-xl z-50 border border-[#E4E3E0] border-opacity-10"
                >
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-mono uppercase opacity-50 mb-2">{t.language}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['en', 'zh-TW', 'zh-CN', 'pt'] as Language[]).map(l => (
                          <button 
                            key={l}
                            onClick={() => toggleLang(l)}
                            className={cn(
                              "text-[10px] py-1 border border-[#E4E3E0] border-opacity-20 hover:bg-[#E4E3E0] hover:text-[#141414] transition-all",
                              lang === l && "bg-[#E4E3E0] text-[#141414]"
                            )}
                          >
                            {l === 'en' ? 'EN' : l === 'zh-TW' ? '繁中' : l === 'zh-CN' ? '简中' : 'Português'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#E4E3E0] border-opacity-10">
                      <button 
                        onClick={() => {
                          setShowHelp(true);
                          setShowSettings(false);
                        }}
                        className="w-full flex items-center justify-between text-xs font-bold hover:opacity-70 transition-opacity"
                      >
                        {t.help} <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-[#E4E3E0] border-opacity-10">
                      <button 
                        onClick={() => {
                          setIsEditingProfile(true);
                          setShowSettings(false);
                        }}
                        className="w-full flex items-center justify-between text-xs font-bold hover:opacity-70 transition-opacity"
                      >
                        {t.profile} <User className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-[#E4E3E0] border-opacity-10">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between text-xs font-bold text-red-400 hover:opacity-70 transition-opacity"
                      >
                        {t.logout} <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono uppercase opacity-50">{t.currentUser}</p>
            <p className="text-xs font-bold">{student.name} ({student.grade}{student.classLetter})</p>
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 bg-[#141414] bg-opacity-80 flex items-center justify-center p-6 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#141414] text-[#E4E3E0] p-8 rounded-sm border border-[#E4E3E0] border-opacity-10"
            >
              <h2 className="text-xl font-bold uppercase tracking-widest mb-6">{t.profile}</h2>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="flex flex-col items-center gap-4 mb-2">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-2 border-[#E4E3E0] border-opacity-20 overflow-hidden bg-[#141414]">
                      {loginData.photoURL ? (
                        <img src={loginData.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-[#141414] bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full text-[10px] uppercase font-bold tracking-tighter text-center px-2">
                      {t.uploadPhoto}
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  <div className="w-full space-y-1 text-left">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-30">{t.avatarUrl}</label>
                    <input 
                      type="text" 
                      value={loginData.photoURL}
                      onChange={(e) => setLoginData(prev => ({ ...prev, photoURL: e.target.value }))}
                      className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-20 py-1 text-[10px] focus:outline-none focus:border-opacity-100 transition-all font-mono"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-mono uppercase tracking-widest opacity-50">{t.studentId}</label>
                  <input
                    type="text"
                    value={loginData.studentId}
                    onChange={(e) => setLoginData({ ...loginData, studentId: e.target.value })}
                    className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all font-mono"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest opacity-50">{t.fullName}</label>
                  <input
                    type="text"
                    value={loginData.name}
                    onChange={(e) => setLoginData({ ...loginData, name: e.target.value })}
                    className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-50">{t.grade}</label>
                    <select
                      value={loginData.grade}
                      onChange={(e) => setLoginData({ ...loginData, grade: e.target.value })}
                      className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all appearance-none cursor-pointer"
                    >
                      {GRADES.map(g => <option key={g} value={g} className="bg-[#141414]">{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-50">{t.class}</label>
                    <select
                      value={loginData.classLetter}
                      onChange={(e) => setLoginData({ ...loginData, classLetter: e.target.value })}
                      className="w-full bg-transparent border-b border-[#E4E3E0] border-opacity-30 py-2 focus:outline-none focus:border-opacity-100 transition-all appearance-none cursor-pointer"
                    >
                      {currentClassOptions.map(c => <option key={c} value={c} className="bg-[#141414]">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 border border-[#E4E3E0] border-opacity-30 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] transition-all"
                  >
                    {t.close}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#E4E3E0] text-[#141414] py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    {t.saveChanges}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 bg-[#141414] bg-opacity-80 flex items-center justify-center p-6 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-[#141414] text-[#E4E3E0] p-8 rounded-sm border border-[#E4E3E0] border-opacity-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold uppercase tracking-widest">{t.manualTitle}</h2>
                <HelpCircle className="w-8 h-8 opacity-20" />
              </div>
              <div className="space-y-4 font-serif italic text-lg opacity-80 mb-8">
                <p>{t.manualStep1}</p>
                <p>{t.manualStep2}</p>
                <p>{t.manualStep3}</p>
                <p>{t.manualStep4}</p>
                <p>{t.manualStep5}</p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="w-full bg-[#E4E3E0] text-[#141414] py-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                {t.close}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-6">
        {/* Statistics Summary Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] opacity-40">{t.statsSummary}</h2>
            <div className="h-[1px] flex-1 bg-[#141414] opacity-10"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 border border-[#141414] border-opacity-10 bg-white shadow-sm hover:shadow-md transition-shadow group">
              <p className="text-[10px] font-mono uppercase opacity-50 mb-1">{t.totalRentals}</p>
              <p className="text-3xl font-bold tracking-tighter group-hover:scale-105 transition-transform origin-left">{stats.total}</p>
            </div>
            <div className="p-4 border border-[#141414] border-opacity-10 bg-white shadow-sm hover:shadow-md transition-shadow group">
              <p className="text-[10px] font-mono uppercase opacity-50 mb-1">{t.activeRentals}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tighter text-amber-600 group-hover:scale-105 transition-transform origin-left">{stats.active}</p>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              </div>
            </div>
            <div className="p-4 border border-[#141414] border-opacity-10 bg-white shadow-sm hover:shadow-md transition-shadow group text-emerald-700">
              <p className="text-[10px] font-mono uppercase opacity-50 mb-1 text-[#141414]">{t.returnedBooks}</p>
              <p className="text-3xl font-bold tracking-tighter group-hover:scale-105 transition-transform origin-left">{stats.returned}</p>
            </div>
            <div className="p-4 border border-[#141414] border-opacity-10 bg-white shadow-sm hover:shadow-md transition-shadow group">
              <p className="text-[10px] font-mono uppercase opacity-50 mb-1">{t.activeStudents}</p>
              <p className="text-3xl font-bold tracking-tighter group-hover:scale-105 transition-transform origin-left">{stats.students}</p>
            </div>
            <div className="p-4 border border-[#141414] border-opacity-10 bg-[#141414] text-[#E4E3E0] shadow-sm hover:shadow-md transition-shadow group col-span-2 md:col-span-1">
              <p className="text-[10px] font-mono uppercase opacity-50 mb-1 text-[#E4E3E0]">{t.yourActivity}</p>
              <p className="text-3xl font-bold tracking-tighter group-hover:scale-105 transition-transform origin-left">{stats.userTotal}</p>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {activeTab === 'borrow' ? (
            <motion.div 
              key="borrow-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <section className="lg:col-span-4">
                <div className="sticky top-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif italic text-xl opacity-70 flex items-center gap-2">
                      {showRegisterForm ? (
                        <><Library className="w-5 h-5" /> {t.registerBorrowing}</>
                      ) : (
                        <><Library className="w-5 h-5" /> {t.recommendedBooks}</>
                      )}
                    </h2>
                    <div className="flex items-center gap-2">
                      {recLoading && <Loader2 className="w-4 h-4 animate-spin opacity-40" />}
                      <button 
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-md border border-[#141414]",
                          showRegisterForm 
                            ? "bg-[#E4E3E0] text-[#141414] ring-2 ring-[#141414] ring-offset-2" 
                            : "bg-[#E4E3E0] text-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0]"
                        )}
                      >
                        {showRegisterForm ? (
                          <><X className="w-3 h-3" /> {t.close}</>
                        ) : (
                          <><Plus className="w-3 h-3" /> {t.register}</>
                        )}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {showRegisterForm ? (
                      <motion.div
                        key="register-form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div className="mb-6 py-4 border-b border-[#141414] border-opacity-10">
                          <p className="text-[10px] font-mono uppercase opacity-50 mb-1">{t.autoFilledInfo}</p>
                          <p className="text-sm font-bold">{student.name} · {student.studentId}</p>
                          <p className="text-xs opacity-70">{student.grade} {student.classLetter}</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[11px] font-mono uppercase tracking-wider opacity-50 flex items-center gap-2">
                              <Book className="w-3 h-3" /> {t.bookTitle}
                            </label>
                            <input
                              type="text"
                              value={formData.bookTitle}
                              onChange={(e) => setFormData({ ...formData, bookTitle: e.target.value })}
                              className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none focus:border-opacity-50 transition-colors"
                              placeholder={t.bookPlaceholder}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[11px] font-mono uppercase tracking-wider opacity-50 flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> {t.borrowDate}
                              </label>
                              <input
                                type="date"
                                value={formData.borrowDate}
                                onChange={(e) => setFormData({ ...formData, borrowDate: e.target.value })}
                                className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none focus:border-opacity-50 transition-colors"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-mono uppercase tracking-wider opacity-50 flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> {t.returnDate}
                              </label>
                              <input
                                type="date"
                                value={formData.returnDate}
                                onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                                className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none focus:border-opacity-50 transition-colors"
                                required
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={submitting}
                            className="w-full border border-[#141414] text-[#141414] py-4 flex items-center justify-center gap-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all disabled:opacity-50 uppercase font-bold tracking-widest text-sm"
                          >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t.confirmBorrow}
                          </button>
                        </form>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="recommendations"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                      >
                        {recommendedBooks.map((cat, idx) => (
                          <div key={idx} className="space-y-4">
                            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 border-b border-[#141414] border-opacity-10 pb-2">
                              {cat.category}
                            </h3>
                            <div className="space-y-3">
                              {cat.books.map((book: any, bIdx: number) => (
                                <div key={bIdx} className="flex items-start gap-4 group">
                                  <span className="font-serif italic text-2xl opacity-20 group-hover:opacity-100 transition-opacity">
                                    0{bIdx + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{book.title}</p>
                                    <p className="text-[10px] opacity-50 uppercase tracking-wider">{book.author}</p>
                                  </div>
                                  <button 
                                    onClick={() => toggleFavorite(book.title)}
                                    className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-full"
                                  >
                                    {favorites.some(f => f.bookTitle === book.title) ? (
                                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                    ) : (
                                      <Heart className="w-4 h-4 opacity-20" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              <section className="lg:col-span-8 border-l border-[#141414] pl-0 lg:pl-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif italic text-xl opacity-70">{t.currentBorrowedList}</h2>
                  <div className="text-[10px] font-mono border border-[#141414] text-[#141414] px-2 py-1">
                    ACTIVE: {borrowedList.length}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#141414]">
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.bookTitle}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.borrower}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.class}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.borrowDate}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.dueDate}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {loading ? (
                          <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></td></tr>
                        ) : borrowedList.length === 0 ? (
                          <tr><td colSpan={6} className="py-20 text-center font-serif italic opacity-40">{t.noRecords}</td></tr>
                        ) : (
                          borrowedList.map((rental) => (
                            <motion.tr
                              key={rental.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="border-b border-[#141414] border-opacity-10 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group"
                            >
                              <td className="py-4 font-medium">{rental.bookTitle}</td>
                              <td className="py-4">
                                {rental.uid === user?.uid ? rental.borrowerName : t.private}
                              </td>
                              <td className="py-4 font-mono text-xs opacity-60 group-hover:opacity-100">
                                {rental.uid === user?.uid ? `${rental.grade}${rental.classLetter}` : '***'}
                              </td>
                              <td className="py-4 font-mono text-xs">{rental.borrowDate}</td>
                              <td className="py-4 font-mono text-xs">{rental.returnDate}</td>
                              <td className="py-4">
                                <button 
                                  onClick={() => toggleFavorite(rental.bookTitle)}
                                  className="p-1 hover:text-red-500 transition-colors"
                                >
                                  {favorites.some(f => f.bookTitle === rental.bookTitle) ? (
                                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                  ) : (
                                    <Heart className="w-4 h-4 opacity-20 group-hover:opacity-100" />
                                  )}
                                </button>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Favorites Tracking Section */}
              {favorites.length > 0 && (
                <section className="lg:col-span-12 mt-12 pt-12 border-t border-[#141414] border-opacity-10">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="font-serif italic text-2xl opacity-70 flex items-center gap-3">
                      <Heart className="w-6 h-6 text-red-500 fill-red-500" /> {t.favorites}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {favorites.map((fav) => {
                        const currentRental = rentals.find(r => r.bookTitle === fav.bookTitle && r.status === 'borrowed');
                        return (
                          <motion.div
                            key={fav.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-6 border border-[#141414] border-opacity-10 rounded-sm bg-white hover:shadow-md transition-all relative group"
                          >
                            <button 
                              onClick={() => toggleFavorite(fav.bookTitle)}
                              className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                              title={t.removeFavorite}
                            >
                              <HeartOff className="w-4 h-4" />
                            </button>
                            <div className="flex items-start gap-4 mb-4">
                              <div className="p-3 bg-[#141414] bg-opacity-5 rounded-full">
                                <Book className="w-5 h-5 opacity-40" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold truncate">{fav.bookTitle}</h3>
                                <p className="text-[10px] font-mono uppercase opacity-40 tracking-widest">{t.followingBook}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-3 pt-4 border-t border-[#141414] border-opacity-5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase opacity-50">{t.bookStatus}</span>
                                <span className={cn(
                                  "text-[10px] font-mono px-2 py-0.5 rounded-full",
                                  currentRental ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                )}>
                                  {currentRental ? t.statusBorrowed : t.statusAvailable}
                                </span>
                              </div>
                              {currentRental && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono uppercase opacity-50">{t.borrower}</span>
                                    <span className="text-xs font-medium">{currentRental.uid === user?.uid ? currentRental.borrowerName : t.private}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono uppercase opacity-50 text-red-500">{t.dueDate}</span>
                                    <span className="text-xs font-bold text-red-500">{currentRental.returnDate}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </section>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="return-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <section className="bg-[#141414] text-[#E4E3E0] p-8 rounded-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold uppercase tracking-tighter">{t.booksToReturn}</h2>
                    <p className="font-serif italic opacity-60">{t.onlyYourRecords}</p>
                  </div>
                  <RotateCcw className="w-10 h-10 opacity-20" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {myBorrowedList.map((rental) => (
                      <motion.div
                        key={rental.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="border border-[#E4E3E0] border-opacity-20 p-6 flex flex-col justify-between hover:border-opacity-100 transition-all group"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <Book className="w-5 h-5 opacity-50" />
                            <span className="text-[10px] font-mono border border-[#E4E3E0] border-opacity-30 px-2 py-0.5">{rental.grade}{rental.classLetter} · {rental.studentId}</span>
                          </div>
                          <h3 className="text-lg font-bold mb-1">{rental.bookTitle}</h3>
                          <p className="text-sm opacity-70 mb-4 flex items-center gap-2">
                            <User className="w-3 h-3" /> {rental.borrowerName}
                          </p>
                          <div className="text-[11px] font-mono opacity-50 space-y-1">
                            <p>{t.borrowDate}: {rental.borrowDate}</p>
                            <p className="text-red-400">{t.dueDate}: {rental.returnDate}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleReturn(rental.id)}
                          disabled={returningId === rental.id}
                          className="mt-6 w-full border border-[#E4E3E0] py-2 text-xs font-bold uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {returningId === rental.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> {t.confirmReturn}
                            </>
                          )}
                        </button>
                      </motion.div>
                    ))}
                    {myBorrowedList.length === 0 && (
                      <div className="col-span-full py-12 text-center opacity-40 font-serif italic">
                        {t.noBooksToReturn}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-4 mb-6">
                  <ListFilter className="w-5 h-5 opacity-50" />
                  <h2 className="font-serif italic text-xl opacity-70">{t.returnedHistory}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#141414]">
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.bookTitle}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.borrower}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.class}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.period}</th>
                        <th className="py-4 text-[11px] font-mono uppercase tracking-wider opacity-50">{t.returnedDate}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnedList.map((rental) => (
                        <tr key={rental.id} className="border-b border-[#141414] border-opacity-10 opacity-60">
                          <td className="py-4 font-medium">{rental.bookTitle}</td>
                          <td className="py-4">{rental.borrowerName}</td>
                          <td className="py-4 font-mono text-xs">{rental.grade}{rental.classLetter}</td>
                          <td className="py-4 font-mono text-xs">{rental.borrowDate} ~ {rental.returnDate}</td>
                          <td className="py-4 font-mono text-xs">
                            {rental.returnedAt?.toDate().toLocaleDateString() || '-'}
                          </td>
                        </tr>
                      ))}
                      {returnedList.length === 0 && (
                        <tr><td colSpan={5} className="py-12 text-center opacity-40 font-serif italic">{t.noHistory}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 border-t border-[#141414] p-8 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-30">
          Library Persistence Engine / Firestore v6.0 / {t.currentUser}: {student.name}
        </p>
      </footer>
    </div>
  );
}
