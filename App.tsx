
import React, { useState, useEffect, useCallback } from 'react';
import { SimulationInputs, SimulationResults, BuildingType } from './types';
import { INITIAL_VALUES } from './constants';
import { calculateSimulation, formatCurrency } from './utils/calculations';
import { getPropertyPitfallsAnalysis, extractPropertyFromUrl, getHazardAnalysis, getExitStrategyData, estimateEquivalentRent } from './services/geminiService';
import { PdfReportModal } from './components/PdfReportModal';
import { 
  TrendingUp, 
  Wallet, 
  RefreshCcw, 
  BrainCircuit,
  ShieldAlert,
  Calculator,
  Zap,
  Loader2,
  BadgeDollarSign,
  CheckCircle2,
  XCircle,
  Scale,
  ReceiptJapaneseYen,
  BarChart3,
  Waves,
  History,
  PiggyBank,
  PlusCircle,
  MinusCircle,
  Info,
  Building2,
  Clock,
  MapPin,
  Percent,
  ArrowRightLeft,
  Coins,
  Printer,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Navigation,
  Train,
  Save,
  Trash2,
  Copy,
  ChevronRight,
  Maximize2,
  Tags,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Search,
  Settings2,
  Minus,
  Plus,
  HelpCircle,
  MessageSquareText,
  LineChart,
  Map,
  Sparkles
} from 'lucide-react';

interface SavedSimulation {
  id: string;
  name: string;
  timestamp: number;
  inputs: SimulationInputs;
  results: SimulationResults;
}

const App: React.FC = () => {
  const [inputs, setInputs] = useState<SimulationInputs>(INITIAL_VALUES);
  const [results, setResults] = useState<SimulationResults>(calculateSimulation(inputs));
  const [propertyPitfalls, setPropertyPitfalls] = useState<string | null>(null);
  const [loadingPitfalls, setLoadingPitfalls] = useState(false);
  
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  
  const [hazardInfo, setHazardInfo] = useState<{ text: string, sources: {title: string, uri: string}[] } | null>(null);
  const [loadingHazard, setLoadingHazard] = useState(false);
  const [exitStrategy, setExitStrategy] = useState<{ text: string, sources: {title: string, uri: string}[] } | null>(null);
  const [loadingExit, setLoadingExit] = useState(false);

  const [propertyUrl, setPropertyUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEstimatingRent, setIsEstimatingRent] = useState(true);

  // 履歴の状態管理
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [saveName, setSaveName] = useState('');

  // 比較リスト内の平均値を算出
  const avgTsuboPrice = savedSimulations.length > 0
    ? savedSimulations.reduce((acc, curr) => acc + (curr.results.purchasePricePerSqM * 3.305785), 0) / savedSimulations.length
    : 0;

  const currentTsuboPrice = results.purchasePricePerSqM * 3.305785;
  const priceDiffPercentage = avgTsuboPrice > 0 
    ? ((currentTsuboPrice - avgTsuboPrice) / avgTsuboPrice) * 100 
    : 0;

  // 賃貸利回りから家賃を計算するガイド機能
  const applyYieldToRent = useCallback(() => {
    const calculatedRent = Math.round((inputs.purchasePrice * (inputs.rentalYield / 100)) / 12 / 1000) * 1000;
    setInputs(prev => ({ ...prev, estimatedMonthlyRent: calculatedRent }));
  }, [inputs.purchasePrice, inputs.rentalYield]);

  // 初回読み込み時にlocalStorageから履歴を取得
  useEffect(() => {
    const stored = localStorage.getItem('condo_sim_history');
    if (stored) {
      try {
        setSavedSimulations(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // 初回起動時にAI検索を自動実行して同等賃貸相場・事例・URLを入力（ユーザーに自分で押させない）
  useEffect(() => {
    handleEstimateRent(INITIAL_VALUES);
  }, []);

  // 履歴が更新されたらlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('condo_sim_history', JSON.stringify(savedSimulations));
  }, [savedSimulations]);

  useEffect(() => {
    setResults(calculateSimulation(inputs));
  }, [inputs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setInputs(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              (name === 'buildingType' ? value : 
               (name === 'propertyAddress' || name === 'targetStation' || name === 'propertyName' || name === 'nearestStation' ? value : parseFloat(value) || 0))
    }));
  };

  const handleUrlExtract = async () => {
    if (!propertyUrl) return;
    setIsExtracting(true);
    
    // 他の物件の解析結果を一度クリア（古い情報が残らないようにする）
    setHazardInfo(null);
    setExitStrategy(null);
    setPropertyPitfalls(null);

    try {
      // タイムアウト付きで物件情報を抽出（ゆとりのある40秒）
      const extractPromise = extractPropertyFromUrl(propertyUrl);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("物件情報の解析がタイムアウトしました。対象のサイトが保護されているか、ネットワークが混雑しています。手動で入力してください。")), 40000)
      );
      
      const { data } = await Promise.race([extractPromise, timeoutPromise]) as any;

      const newInputs: SimulationInputs = {
        ...inputs,
        propertyName: data.propertyName || inputs.propertyName,
        purchasePrice: data.purchasePrice || inputs.purchasePrice,
        areaSize: data.areaSize || inputs.areaSize,
        maintenanceFee: data.maintenanceFee || inputs.maintenanceFee,
        repairFund: data.repairFund || inputs.repairFund,
        propertyAddress: data.propertyAddress || inputs.propertyAddress,
        nearestStation: data.nearestStation !== undefined ? data.nearestStation : inputs.nearestStation,
        walkMinutes: data.walkMinutes !== undefined ? data.walkMinutes : inputs.walkMinutes,
        buildingAge: data.buildingAge !== undefined ? data.buildingAge : inputs.buildingAge,
        buildingType: (data.buildingType as BuildingType) || inputs.buildingType,
        estimatedMonthlyRent: data.estimatedMonthlyRent || inputs.estimatedMonthlyRent,
        estimatedRentReasoning: data.estimatedRentReasoning || inputs.estimatedRentReasoning,
      };

      setInputs(newInputs);

      // 物件URL解析完了時も、自動で周辺事例・参照URLを含む詳細賃貸相場リサーチを実行
      handleEstimateRent(newInputs);

      if (data.propertyAddress) {
        fetchLocationAnalysis(data.propertyAddress);
      } else {
        setLoadingHazard(false);
        setLoadingExit(false);
      }
    } catch (error: any) {
      alert(error.message || "物件情報の取得に失敗しました。URLが正しいか、または手動で入力してください。");
      setLoadingHazard(false);
      setLoadingExit(false);
    } finally {
      setIsExtracting(false);
    }
  };

  // 立地ハザード評価を単独で取得（共倒れ防止＆個別再取得用）
  const fetchHazardOnly = async (address?: string) => {
    const targetAddress = address || inputs.propertyAddress;
    if (!targetAddress || targetAddress.trim() === '') {
      alert("物件の住所を入力してください。");
      return;
    }
    setLoadingHazard(true);
    try {
      const hazardPromise = getHazardAnalysis(targetAddress);
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error("タイムアウト")), 40000)
      );
      const hazard = await Promise.race([hazardPromise, timeoutPromise]);
      setHazardInfo(hazard);
    } catch (error: any) {
      console.error("Hazard Analysis Error:", error);
      setHazardInfo({ text: "ハザード情報の取得に時間がかかりました。時間を置いて再度お試しください。", sources: [] });
    } finally {
      setLoadingHazard(false);
    }
  };

  // 出口戦略・将来相場を単独で取得（共倒れ防止＆個別再取得用）
  const fetchExitOnly = async (address?: string) => {
    const targetAddress = address || inputs.propertyAddress;
    if (!targetAddress || targetAddress.trim() === '') {
      alert("物件の住所を入力してください。");
      return;
    }
    setLoadingExit(true);
    try {
      const exitPromise = getExitStrategyData(targetAddress, inputs.yearsHeld, inputs.nearestStation, inputs.buildingAge);
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error("タイムアウト")), 40000)
      );
      const exit = await Promise.race([exitPromise, timeoutPromise]);
      setExitStrategy(exit);
    } catch (error: any) {
      console.error("Exit Strategy Error:", error);
      setExitStrategy({ text: "出口相場データの取得に時間がかかりました。時間を置いて再度お試しください。", sources: [] });
    } finally {
      setLoadingExit(false);
    }
  };

  // エリア解析の並行独立実行
  const fetchLocationAnalysis = (address: string) => {
    fetchHazardOnly(address);
    fetchExitOnly(address);
  };

  // AIによる同等賃貸相場のWebリサーチ（初回起動時や物件変更時に自動実行）
  const handleEstimateRent = async (targetInputs?: SimulationInputs) => {
    const currentInputs = targetInputs || inputs;
    setIsEstimatingRent(true);
    try {
      const res = await estimateEquivalentRent(currentInputs);
      if (res.estimatedMonthlyRent > 0) {
        setInputs(prev => ({
          ...prev,
          estimatedMonthlyRent: res.estimatedMonthlyRent,
          estimatedRentReasoning: res.reasoning,
          estimatedRentExamples: res.examples,
          estimatedRentSources: res.sources
        }));
      }
    } catch (e: any) {
      console.error("Rent Estimation Failed:", e);
    } finally {
      setIsEstimatingRent(false);
    }
  };

  const runPitfallsAnalysis = async () => {
    setLoadingPitfalls(true);
    const advice = await getPropertyPitfallsAnalysis(propertyUrl, inputs, results);
    setPropertyPitfalls(advice.text);
    setLoadingPitfalls(false);
  };

  const handleSaveSimulation = () => {
    const newSave: SavedSimulation = {
      id: crypto.randomUUID(),
      name: saveName || inputs.propertyName || inputs.propertyAddress || `物件案 ${savedSimulations.length + 1}`,
      timestamp: Date.now(),
      inputs: { ...inputs },
      results: { ...results }
    };
    setSavedSimulations([newSave, ...savedSimulations]);
    setSaveName('');
  };

  const handleDeleteSimulation = (id: string) => {
    setSavedSimulations(savedSimulations.filter(s => s.id !== id));
  };

  const handleLoadSimulation = (save: SavedSimulation) => {
    setInputs(save.inputs);
    setPropertyPitfalls(null);
    setHazardInfo(null);
    setExitStrategy(null);
    // 再読み込み時にハザードと出口戦略を再解析
    if (save.inputs.propertyAddress) {
      fetchLocationAnalysis(save.inputs.propertyAddress);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 0.1%刻みでの騰落率調整
  const adjustAppreciation = (delta: number) => {
    setInputs(prev => ({
      ...prev,
      appreciationRate: Math.round((prev.appreciationRate + delta) * 10) / 10
    }));
  };

  // CSV出力機能
  const handleExportCSV = () => {
    const rows = [
      ['項目', '値'],
      ['物件名', inputs.propertyName],
      ['住所', inputs.propertyAddress],
      ['最寄駅名', inputs.nearestStation],
      ['最寄り駅からの徒歩分数', inputs.walkMinutes ? inputs.walkMinutes + '分' : ''],
      ['築年数', inputs.buildingAge ? inputs.buildingAge + '年' : ''],
      ['物件価格', inputs.purchasePrice],
      ['専有面積', inputs.areaSize + '㎡'],
      ['頭金', inputs.downPayment],
      ['現在の家からの引越費用(入居時)', inputs.initialMovingCosts ?? inputs.movingCosts],
      ['売却後の引越費用(退去時)', inputs.exitMovingCosts ?? 200000],
      ['ローン金利', inputs.interestRate + '%'],
      ['ローン期間', inputs.mortgageTerm + '年'],
      ['保有期間', inputs.yearsHeld + '年'],
      ['予想価格変化率', " " + inputs.appreciationRate + "%/年"],
      [],
      ['単価データ', ''],
      ['購入㎡単価', Math.round(results.purchasePricePerSqM)],
      ['賃料㎡単価', Math.round(results.rentPerSqM)],
      [],
      ['シミュレーション結果', ''],
      ['想定売却価格', results.sellingPrice],
      ['売却時ローン残債', results.remainingMortgageBalance],
      ['売却時手残り', results.sellingPrice - results.remainingMortgageBalance],
      ['購入実質総負担額', results.netCostBuy],
      ['同等賃貸総コスト', results.totalRentalCost],
      ['購入vs同等賃貸の差額(プラスで購入が得)', results.buyVsRentDifference],
      ['実質住居コスト/月', results.monthlyHousingCost],
      ['比較対象賃料/月', results.estimatedMonthlyRent],
      [],
      ['年次推移データ', ''],
      ['経過年数', '資産価値', 'ローン残債', '累計支出', '含み益(純資産)', '賃貸累計コスト']
    ];

    results.yearlyData.forEach(data => {
      rows.push([
        data.year + '年',
        Math.round(data.propertyValue),
        Math.round(data.mortgageBalance),
        Math.round(data.cumulativeCost),
        Math.round(data.equity),
        Math.round(data.cumulativeRentalCost)
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `condo_simulation_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPdfReport = () => {
    setIsPdfModalOpen(true);
  };

  // ①コスト（支出合計）
  const bucket1_costs = 
    inputs.downPayment + 
    results.initialTotalCost + 
    results.totalMortgagePayments +   
    results.totalMaintenanceCosts +   
    results.totalTaxPaid +            
    results.sellingCosts + 
    results.taxAmount;

  // ②利益（回収合計）
  const bucket2_gains = 
    (results.sellingPrice - results.remainingMortgageBalance) + 
    results.totalMortgageTaxCredit;

  // 純利益
  const netInvestmentResult = bucket2_gains - bucket1_costs;
  const realMonthlyCost = netInvestmentResult >= 0 ? 0 : Math.abs(netInvestmentResult / (inputs.yearsHeld * 12));

  // 賃貸コスト (現在住んでいる物件を継続した場合)
  const totalMonthlyRental = inputs.currentMonthlyRent + (inputs.currentMonthlyRent * 0.05) + (inputs.currentMonthlyRent / 24);

  // Google Maps URL 生成
  const googleMapsUrl = inputs.propertyAddress 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inputs.propertyAddress)}`
    : null;

  const targetLocationUrl = inputs.targetStation 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inputs.targetStation)}`
    : null;

  const googleRouteUrl = (inputs.propertyAddress && inputs.targetStation)
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(inputs.propertyAddress)}&destination=${encodeURIComponent(inputs.targetStation)}&travelmode=transit`
    : null;

  // 賃貸相場検索URL
  const homesSearchUrl = inputs.propertyAddress 
    ? `https://www.homes.co.jp/chintai/search/?query=${encodeURIComponent(inputs.propertyAddress)}` 
    : null;
  const suumoSearchUrl = inputs.propertyAddress 
    ? `https://www.suumo.jp/jj/chintai/ichiran/FR301FC001/?ar=030&bs=040&fw=${encodeURIComponent(inputs.propertyAddress)}` 
    : null;

  // 口コミ・査定サイトURL
  const mansionCommunityUrl = inputs.propertyName 
    ? `https://www.google.com/search?q=site:e-mansion.co.jp+${encodeURIComponent(inputs.propertyName)}` 
    : null;
  const ieshilUrl = inputs.propertyName 
    ? `https://www.ieshil.com/search/?q=${encodeURIComponent(inputs.propertyName)}` 
    : null;

  // 売却価格計算ロジック（年次複利）
  const totalAppreciationMultiplier = Math.pow(1 + inputs.appreciationRate / 100, inputs.yearsHeld);
  const appreciationLogicText = `計算式: 購入価格 ${formatCurrency(inputs.purchasePrice)} × (1 + 年騰落率 ${inputs.appreciationRate}% ) ^ ${inputs.yearsHeld}年`;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-['Inter','Noto_Sans_JP']">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          main { margin-top: 0 !important; padding: 0 !important; }
          .max-w-7xl { max-width: 100% !important; width: 100% !important; margin: 0 !important; }
          .shadow-sm, .shadow-lg, .shadow-2xl { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          header { position: static !important; border-bottom: 2px solid #e2e8f0 !important; }
          aside { border: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1.5 rounded-lg">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Condo Wealth <span className="text-blue-600">Pro</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleExportCSV} className="no-print text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-md">
              <FileSpreadsheet className="w-4 h-4" /> CSV出力
            </button>
            <button type="button" onClick={handleOpenPdfReport} className="no-print text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-md">
              <FileText className="w-4 h-4" /> PDFレポート出力
            </button>
            <button type="button" onClick={() => {setInputs(INITIAL_VALUES); setHazardInfo(null); setExitStrategy(null); handleEstimateRent(INITIAL_VALUES);}} className="no-print text-sm text-slate-400 hover:text-rose-600 flex items-center gap-1 active:scale-95 transition-all" title="初期値にリセット">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左サイドバー: 設定エリア */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* AIデータ解析 & マンコミュ・イエシル検索 */}
            <section className="no-print bg-slate-900 rounded-2xl shadow-lg p-6 text-white border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <BrainCircuit className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold">AI物件データ解析</h2>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder="物件URLを貼り付け" 
                    value={propertyUrl} 
                    onChange={(e) => setPropertyUrl(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {propertyUrl && (
                    <button type="button" onClick={() => setPropertyUrl('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      <XCircle size={18} />
                    </button>
                  )}
                </div>
                <button onClick={handleUrlExtract} disabled={isExtracting || !propertyUrl} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />} 解析・反映
                </button>

                {/* 物件名と口コミ査定リンク */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">検討物件名</label>
                  <input 
                    type="text" name="propertyName" value={inputs.propertyName} onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-blue-300 font-bold focus:outline-none"
                    placeholder="マンション名（例：パークタワー...）"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={mansionCommunityUrl || '#'} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                        mansionCommunityUrl ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-white/5 text-white/20'
                      }`}
                    >
                      <MessageSquareText size={12} /> マンコミュ検索
                    </a>
                    <a 
                      href={ieshilUrl || '#'} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                        ieshilUrl ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-white/5 text-white/20'
                      }`}
                    >
                      <LineChart size={12} /> イエシル査定
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* 基本ローン・所在地・マップ連携 */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calculator className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-bold">購入・所在地条件</h2>
              </div>
              <div className="space-y-4 text-sm">
                <div className="print:border-b print:pb-2">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <MapPin size={12} /> 所在地（住所）
                  </label>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" name="propertyAddress" value={inputs.propertyAddress} onChange={handleInputChange} 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
                      placeholder="例: 東京都港区..." 
                    />
                    {googleMapsUrl && (
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="no-print w-full py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-700 flex items-center justify-center gap-2 font-black text-[10px] transition-all">
                        <Map size={14} /> 物件の場所を地図で確認
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">最寄駅</label>
                    <input type="text" name="nearestStation" value={inputs.nearestStation} onChange={handleInputChange} placeholder="例: 大崎駅" className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">駅徒歩 (分)</label>
                    <input type="number" name="walkMinutes" value={inputs.walkMinutes} onChange={handleInputChange} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">築年数 (年)</label>
                    <input type="number" name="buildingAge" value={inputs.buildingAge} onChange={handleInputChange} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 print:border-b print:pb-2">
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">購入価格 (円)</label>
                    <input type="number" name="purchasePrice" value={inputs.purchasePrice} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-lg text-blue-600" />
                  </div>
                  <div className="print:border-b print:pb-2">
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">専有面積 (㎡)</label>
                    <input type="number" name="areaSize" value={inputs.areaSize} onChange={handleInputChange} className={`w-full px-4 py-2 bg-slate-50 border rounded-lg font-bold ${inputs.areaSize < 50 ? 'border-amber-200' : 'border-slate-200'}`} />
                    {inputs.areaSize < 50 && (
                      <p className="text-[9px] text-amber-600 mt-1 font-bold">※50㎡未満のため住宅ローン控除対象外</p>
                    )}
                  </div>
                  <div className="print:border-b print:pb-2">
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">手取り月収 (円)</label>
                    <input type="number" name="monthlyTakeHomeIncome" value={inputs.monthlyTakeHomeIncome} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" />
                  </div>
                  <div className="print:border-b print:pb-2"><label className="block text-xs font-black text-slate-400 uppercase mb-1">頭金 (円)</label><input type="number" name="downPayment" value={inputs.downPayment} onChange={handleInputChange} className="w-full px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-700" /></div>
                  <div className="print:border-b print:pb-2"><label className="block text-xs font-black text-slate-400 uppercase mb-1">ローン期間</label><input type="number" name="mortgageTerm" value={inputs.mortgageTerm} onChange={handleInputChange} className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg font-bold text-blue-700" /></div>
                  <div className="print:border-b print:pb-2"><label className="block text-xs font-black text-slate-400 uppercase mb-1">金利 (%)</label><input type="number" step="0.01" name="interestRate" value={inputs.interestRate} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" /></div>
                  <div className="print:border-b print:pb-2"><label className="block text-xs font-black text-slate-400 uppercase mb-1">保有期間 (年)</label><input type="number" name="yearsHeld" value={inputs.yearsHeld} onChange={handleInputChange} className="w-full px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg font-black text-amber-700" /></div>
                  <div className="print:border-b print:pb-2">
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">現住居からの引越費用 (円)</label>
                    <input type="number" name="initialMovingCosts" value={inputs.initialMovingCosts ?? inputs.movingCosts} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" />
                    <span className="text-[9px] text-slate-400 block mt-0.5">※購入・入居時の引越し代</span>
                  </div>
                  <div className="print:border-b print:pb-2">
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">売却後の引越費用 (円)</label>
                    <input type="number" name="exitMovingCosts" value={inputs.exitMovingCosts ?? 200000} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" />
                    <span className="text-[9px] text-slate-400 block mt-0.5">※{inputs.yearsHeld}年後売却・退去時</span>
                  </div>
                </div>
              </div>
            </section>

            {/* アクセス・ルート検索セクション */}
            <section className="no-print bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold">通勤・アクセス詳細</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">目的地（職場・任意の建物など）</label>
                  <input 
                    type="text" name="targetStation" value={inputs.targetStation} onChange={handleInputChange} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="例: 大手町駅, 港区立...ビル"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a 
                    href={targetLocationUrl || '#'} target={targetLocationUrl ? "_blank" : "_self"} rel="noopener noreferrer"
                    className={`py-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all ${
                      targetLocationUrl ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200' : 'bg-slate-50 text-slate-300'
                    }`}
                  >
                    <Search size={12} /> 目的地を表示
                  </a>
                  <a 
                    href={googleRouteUrl || '#'} target={googleRouteUrl ? "_blank" : "_self"} rel="noopener noreferrer"
                    className={`py-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all ${
                      googleRouteUrl ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' : 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    <Train size={12} /> ルートを検索
                  </a>
                </div>
              </div>
            </section>

            {/* ランニングコスト設定セクション */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold">ランニングコスト (月額)</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">管理費 (円)</label>
                    <input type="number" name="maintenanceFee" value={inputs.maintenanceFee} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">修繕積立金 (円)</label>
                    <input type="number" name="repairFund" value={inputs.repairFund} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  ※内訳目安：管理費（共用部清掃・電気代・管理委託費等）、修繕積立金（将来の外壁塗装・屋上防水等）
                </p>
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase">固定資産税・都市計画税 (年額)</label>
                    <div className="flex items-center gap-2">
                      <div className="group relative cursor-help">
                        <HelpCircle size={12} className="text-slate-400" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-xl leading-relaxed">
                          <p className="font-bold mb-1 text-blue-400">【固定資産税の自動計算】</p>
                          <p>土地面積、地価、建物評価額を元に算出します。住宅用地特例（200㎡以下1/6等）や新築住宅の減額措置も考慮されます。</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">自動計算</span>
                      <input type="checkbox" name="useAutoTax" checked={inputs.useAutoTax} onChange={handleInputChange} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    </div>
                  </div>
                  <input 
                    type="number" name="fixedAssetTax" value={inputs.fixedAssetTax} onChange={handleInputChange} disabled={inputs.useAutoTax}
                    className={`w-full px-4 py-2 rounded-lg font-bold ${inputs.useAutoTax ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-slate-50 border-slate-200'}`} 
                  />
                  
                  {inputs.useAutoTax && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings2 size={14} className="text-blue-600" />
                        <span className="text-[10px] font-black text-blue-800 uppercase">詳細計算パラメータ</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">土地面積 (㎡)</label>
                          <input type="number" name="landArea" value={inputs.landArea} onChange={handleInputChange} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-xs font-bold" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">土地単価 (円/㎡)</label>
                          <input type="number" name="landValuationPerSqM" value={inputs.landValuationPerSqM} onChange={handleInputChange} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-xs font-bold" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">建物評価額 (円)</label>
                          <input type="number" name="buildingValuation" value={inputs.buildingValuation} onChange={handleInputChange} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-xs font-bold" />
                        </div>
                        <div className="col-span-2 flex items-center justify-between">
                          <label className="text-[9px] font-black text-slate-400 uppercase">新築軽減 (1/2)</label>
                          <div className="flex items-center gap-2">
                            <select name="newBuildingReductionYears" value={inputs.newBuildingReductionYears} onChange={handleInputChange} className="text-[10px] bg-white border border-blue-200 rounded px-1 py-0.5">
                              <option value={3}>3年</option>
                              <option value={5}>5年</option>
                            </select>
                            <input type="checkbox" name="isNewBuildingReduction" checked={inputs.isNewBuildingReduction} onChange={handleInputChange} className="w-3 h-3 rounded border-blue-300 text-blue-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed italic">
                    ※見積根拠：土地評価額（面積×単価）と建物評価額を元に、住宅用地特例（1/6等）と新築軽減を適用して算出しています。
                  </p>
                </div>
              </div>
            </section>

            {/* 賃貸比較設定セクション */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold">賃貸比較・相場設定</h2>
              </div>
              <div className="space-y-5">
                {/* 同等賃貸の想定家賃 */}
                <div className="p-4 bg-slate-900 rounded-xl text-white space-y-3 shadow-md border border-indigo-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="block text-xs font-black text-indigo-300 uppercase">購入物件と同等レベルの賃貸相場</label>
                        {isEstimatingRent && (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> AI検索中
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">同マンション・同等面積・類似築年の月額家賃（共益費込）</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        step="1000"
                        name="estimatedMonthlyRent" 
                        value={inputs.estimatedMonthlyRent || ''} 
                        placeholder={isEstimatingRent ? "AIが自動推計中..." : "想定月額家賃"}
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg font-black text-lg focus:ring-2 focus:ring-indigo-400 outline-none placeholder:text-slate-500 placeholder:text-xs placeholder:font-normal" 
                      />
                      {isEstimatingRent && inputs.estimatedMonthlyRent === 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-indigo-400 text-xs font-bold pointer-events-none">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-[10px]">AI検索中...</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button 
                        type="button" 
                        onClick={() => setInputs(prev => ({ ...prev, estimatedMonthlyRent: Math.max(0, prev.estimatedMonthlyRent - 10000) }))}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 active:scale-95"
                        title="1万円下げる"
                      >
                        -1万
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setInputs(prev => ({ ...prev, estimatedMonthlyRent: prev.estimatedMonthlyRent + 10000 }))}
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 active:scale-95"
                        title="1万円上げる"
                      >
                        +1万
                      </button>
                    </div>
                  </div>

                  {/* AI自動リサーチボタン */}
                  <button 
                    type="button" 
                    onClick={() => handleEstimateRent()} 
                    disabled={isEstimatingRent}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    {isEstimatingRent ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>AIが周辺相場・募集事例を自動リサーチ中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-amber-300" />
                        <span>AIで最新の相場・事例を再リサーチ</span>
                      </>
                    )}
                  </button>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                    <span>※初回起動時・物件解析時に自動実行</span>
                    {inputs.estimatedMonthlyRent > 0 && !isEstimatingRent && (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> AI相場反映中
                      </span>
                    )}
                  </div>

                  {/* AI推計の根拠メモ・参考事例・参照URL */}
                  {inputs.estimatedRentReasoning && (
                    <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-[11px] text-slate-300 leading-relaxed space-y-2">
                      <div>
                        <span className="font-bold text-indigo-300 flex items-center gap-1 mb-0.5">
                          💡 賃料算定根拠:
                        </span>
                        <p className="text-slate-200">{inputs.estimatedRentReasoning}</p>
                      </div>

                      {/* 具体的な参考賃貸事例 */}
                      {inputs.estimatedRentExamples && inputs.estimatedRentExamples.length > 0 && (
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          <span className="font-bold text-indigo-300 text-[10px] block">
                            🏢 参照した類似賃貸事例:
                          </span>
                          <div className="space-y-1.5">
                            {inputs.estimatedRentExamples.map((ex, idx) => (
                              <div key={idx} className="p-2 bg-black/20 rounded-lg border border-white/5 text-[10px]">
                                <div className="flex justify-between items-start gap-1">
                                  <span className="font-bold text-white truncate max-w-[170px]">{ex.propertyName}</span>
                                  <span className="text-emerald-400 font-black shrink-0">{ex.rentText}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400">
                                  <span>{[ex.area, ex.floor].filter(Boolean).join(' / ')}</span>
                                  {ex.url ? (
                                    <a href={ex.url} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-white flex items-center gap-0.5 underline">
                                      {ex.sourceName || '物件を見る'} <ExternalLink size={9} />
                                    </a>
                                  ) : (
                                    <span>{ex.sourceName}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 参照した相場・物件URL */}
                      {inputs.estimatedRentSources && inputs.estimatedRentSources.length > 0 && (
                        <div className="pt-2 border-t border-white/10">
                          <span className="font-bold text-indigo-300 text-[10px] block mb-1">
                            🔗 参照元・相場ページURL:
                          </span>
                          <div className="flex flex-col gap-1">
                            {inputs.estimatedRentSources.map((src, idx) => (
                              <a
                                key={idx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] bg-white/5 hover:bg-white/15 text-indigo-200 hover:text-white px-2 py-1 rounded transition-colors flex items-center justify-between gap-1 border border-white/5"
                              >
                                <span className="truncate">{src.title || src.uri}</span>
                                <ExternalLink size={10} className="shrink-0 text-indigo-400" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 利回りから逆算する補助機能 */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                      <span>想定利回りから逆算 (%)</span>
                      <span>{((inputs.estimatedMonthlyRent * 12) / (inputs.purchasePrice || 1) * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="0.1" 
                        name="rentalYield" 
                        value={inputs.rentalYield} 
                        onChange={handleInputChange} 
                        className="w-20 px-2.5 py-1 bg-slate-800 border border-slate-700 text-white rounded font-bold text-xs" 
                      />
                      <button 
                        type="button" 
                        onClick={applyYieldToRent} 
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 rounded text-[11px] font-bold border border-slate-700 transition-all"
                      >
                        利回りから家賃を適用
                      </button>
                    </div>
                  </div>
                </div>

                {/* 現在の家賃 */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-black text-slate-600 uppercase mb-1">現在住んでいる物件の家賃 (月額)</label>
                  <input type="number" name="currentMonthlyRent" value={inputs.currentMonthlyRent} onChange={handleInputChange} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <p className="text-[9px] text-slate-400 mt-1 italic">※現状維持の参考値として使用されます</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <a href={homesSearchUrl || '#'} target="_blank" rel="noopener noreferrer" className={`py-2 px-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1 transition-all ${homesSearchUrl ? 'bg-[#ff5a00] text-white hover:opacity-90' : 'bg-slate-100 text-slate-300'}`}>HOME'S 相場 <ExternalLink size={10} /></a>
                  <a href={suumoSearchUrl || '#'} target="_blank" rel="noopener noreferrer" className={`py-2 px-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1 transition-all ${suumoSearchUrl ? 'bg-[#b3d300] text-[#000] hover:opacity-90' : 'bg-slate-100 text-slate-300'}`}>SUUMO 相場 <ExternalLink size={10} /></a>
                </div>
              </div>
            </section>
          </aside>

          {/* 右メインコンテンツ: 解析結果 */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* 保存アクション */}
            <div className="no-print bg-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-200 flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Save className="text-indigo-200 w-5 h-5" />
                <input 
                  type="text" placeholder="シミュレーション名を入力して比較リストに追加" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 flex-1"
                />
              </div>
              <button onClick={handleSaveSimulation} className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-sm hover:bg-indigo-50 active:scale-95 transition-all shadow-md">比較リストに追加</button>
            </div>

            {/* 毎月の収支カード */}
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                <ReceiptJapaneseYen className="text-blue-600 w-6 h-6" />
                <h3 className="text-lg font-black text-slate-800">所有期間中の毎月のキャッシュフロー</h3>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm border-b pb-2"><span className="text-slate-500">住宅ローン返済</span><span className="font-bold">{formatCurrency(results.monthlyMortgagePayment)}</span></div>
                    <div className="flex justify-between text-sm border-b pb-2">
                      <div className="flex flex-col">
                        <span className="text-slate-500">管理費・修繕積立金</span>
                        <span className="text-[10px] text-slate-400">（管理費: {formatCurrency(results.monthlyMaintenanceFee)} / 修繕: {formatCurrency(results.monthlyRepairFund)}）</span>
                      </div>
                      <span className="font-bold">{formatCurrency(results.monthlyMaintenanceFee + results.monthlyRepairFund)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-b pb-2">
                      <div className="flex flex-col">
                        <span className="text-slate-500">固定資産税等(月割)</span>
                        <span className="text-[10px] text-slate-400">（年額目安: {formatCurrency(results.totalInitialPropertyTax)}）</span>
                      </div>
                      <span className="font-bold">{formatCurrency(results.monthlyTaxEquivalent)}</span>
                    </div>
                  </div>
                  <div className="pt-4 space-y-4">
                    <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-400 uppercase">月間住居費 合計</span><span className="text-3xl font-black text-blue-600">{formatCurrency(results.monthlyHousingCost)}</span></div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                      <div className="flex items-center gap-2"><Coins className="text-emerald-600 w-4 h-4" /><span className="text-xs font-black text-emerald-800 uppercase">手元に残る金額</span></div>
                      <span className="text-2xl font-black text-emerald-600">{formatCurrency(results.monthlySurplus)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col justify-center">
                  <p className="text-xs font-black text-slate-400 uppercase mb-1">Housing Cost Ratio</p>
                  <div className="flex items-baseline gap-2 mb-2"><span className="text-4xl font-black">{results.housingCostRatio.toFixed(1)}</span><span className="text-lg text-slate-500">%</span></div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${results.housingCostRatio > 35 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, results.housingCostRatio)}%`}} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-4 italic">※手取り月収に対する住居費の割合</p>
                </div>
              </div>
            </section>

            {/* 物件単価データ */}
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center justify-between pr-8">
                <div className="flex items-center gap-3"><Tags className="text-blue-600 w-6 h-6" /><h3 className="text-lg font-black text-slate-800">物件単価データ (指標)</h3></div>
                {savedSimulations.length > 0 && (
                  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black ${priceDiffPercentage > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {priceDiffPercentage > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    リスト平均比: {Math.abs(priceDiffPercentage).toFixed(1)}% {priceDiffPercentage > 0 ? '割高' : '割安'}
                  </div>
                )}
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">購入 ㎡単価</p><div className="text-2xl font-black text-slate-800">{formatCurrency(results.purchasePricePerSqM)}<span className="text-xs text-slate-500 ml-1">/㎡</span></div></div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">賃料 ㎡単価</p><div className="text-2xl font-black text-blue-600">{formatCurrency(results.rentPerSqM)}<span className="text-xs text-slate-500 ml-1">/㎡</span></div></div>
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-center shadow-lg"><p className="text-[10px] font-black text-indigo-400 uppercase mb-2">購入 坪単価</p><div className="text-2xl font-black text-white">{formatCurrency(results.purchasePricePerSqM * 3.305785)}<span className="text-xs text-slate-400 ml-1">/坪</span></div></div>
              </div>
            </section>

            {/* 固定資産税の内訳詳細 */}
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                <Scale className="text-blue-600 w-6 h-6" />
                <h3 className="text-lg font-black text-slate-800">固定資産税・都市計画税の計算根拠</h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-2">土地 (住宅用地特例適用)</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">土地評価額</span>
                        <span className="font-bold">{formatCurrency(results.landEvaluation)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 italic">
                        <span>計算根拠</span>
                        <span>{inputs.landArea > 0 ? `${inputs.landArea}㎡ × ${formatCurrency(inputs.landValuationPerSqM)}` : `物件価格 × ${inputs.landRatio}% × 70%`}</span>
                      </div>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">固定資産税 (1.4%)</span>
                          <span className="font-bold text-blue-600">{formatCurrency(results.estimatedInitialFixedAssetTax)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">都市計画税 (0.3%)</span>
                          <span className="font-bold text-blue-600">{formatCurrency(results.estimatedInitialCityPlanningTax)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-2">建物 (経年減価・新築軽減)</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">建物評価額 (初年度)</span>
                        <span className="font-bold">{formatCurrency(results.buildingEvaluation)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 italic">
                        <span>計算根拠</span>
                        <span>{inputs.buildingValuation > 0 ? '入力値' : `物件価格 × ${100 - inputs.landRatio}% × 60%`}</span>
                      </div>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">新築軽減措置</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inputs.isNewBuildingReduction ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {inputs.isNewBuildingReduction ? `適用中 (${inputs.newBuildingReductionYears}年間 1/2)` : '非適用'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">建物税額 合計</span>
                          <span className="font-bold text-blue-600">
                            {formatCurrency(results.totalInitialPropertyTax - results.estimatedInitialFixedAssetTax - results.estimatedInitialCityPlanningTax)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Info size={16} className="text-blue-600" />
                      <span className="text-sm font-black text-blue-900">初年度 納税予測 合計</span>
                    </div>
                    <span className="text-2xl font-black text-blue-600">{formatCurrency(results.totalInitialPropertyTax)}</span>
                  </div>
                  <p className="text-[10px] text-blue-700/70 mt-3 leading-relaxed">
                    ※固定資産税は、毎年1月1日時点の所有者に課されます。評価額は3年ごとに見直されます。
                    本シミュレーションでは、土地は住宅用地特例（200㎡以下1/6等）を適用し、建物は新築軽減措置（一定期間1/2）を考慮しています。
                  </p>
                </div>
              </div>
            </section>

            {/* トータル収支 & 売却価格調整 */}
            <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                <BarChart3 className="text-slate-800 w-6 h-6" />
                <h3 className="text-lg font-black text-slate-800">{inputs.yearsHeld}年間のトータル投資収支</h3>
              </div>
              <div className="p-8 space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-rose-600 font-black text-xs uppercase border-b border-rose-100 pb-2"><MinusCircle size={16} /> ① コスト（支出合計）</div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center text-slate-500">
                        <div className="flex flex-col">
                          <span>初期費用（諸経費＋頭金）</span>
                          {results.initialBrokerageFee > 0 && (
                            <span className="text-[10px] text-slate-400">（内、仲介手数料: {formatCurrency(results.initialBrokerageFee)}）</span>
                          )}
                        </div>
                        <span className="font-bold">{formatCurrency(inputs.downPayment + results.initialTotalCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500"><span>ローン返済累計</span><span className="font-bold">{formatCurrency(results.totalMortgagePayments)}</span></div>
                      <div className="flex justify-between items-center text-slate-500"><span>管理費・固定資産税等累計</span><span className="font-bold">{formatCurrency(results.totalMaintenanceCosts + results.totalTaxPaid)}</span></div>
                      <div className="flex justify-between items-center text-slate-500">
                        <div className="flex flex-col">
                          <span>売却諸経費・譲渡所得税</span>
                          <span className="text-[10px] text-slate-400">（内、仲介手数料: {formatCurrency(results.sellingBrokerageFee)}）</span>
                        </div>
                        <span className="font-bold">{formatCurrency(results.sellingCosts + results.taxAmount)}</span>
                      </div>
                      <div className="pt-3 border-t-2 border-rose-200 flex justify-between items-center text-rose-800 font-black"><span>① すべての支出合計</span><span className="text-xl">{formatCurrency(bucket1_costs)}</span></div>
                    </div>
                  </div>
                  <div className="space-y-6 flex flex-col">
                    <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase border-b border-emerald-100 pb-2"><PlusCircle size={16} /> ② 利益（回収合計）</div>
                    <div className="space-y-4 text-sm flex-1">
                      {/* 売却価格調整カード */}
                      <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 space-y-3 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div><span className="text-emerald-700 font-black text-lg block">売却時手残り</span><div className="flex items-center gap-1 group relative cursor-help"><span className="text-[10px] text-emerald-600/70 font-bold underline decoration-dotted">（売却価格 - ローン残債）</span><HelpCircle size={10} className="text-emerald-400" /><div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-xl">{appreciationLogicText}</div></div></div>
                          <span className="font-black text-2xl text-emerald-700">{formatCurrency(results.sellingPrice - results.remainingMortgageBalance)}</span>
                        </div>
                        <div className="pt-2 border-t border-emerald-100">
                          <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black text-emerald-800 uppercase tracking-tighter">想定売却価格: {formatCurrency(results.sellingPrice)}</span><span className="text-xs font-black text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100">{inputs.appreciationRate > 0 ? '+' : ''}{inputs.appreciationRate}% /年</span></div>
                          <div className="no-print flex items-center gap-2">
                            <button onClick={() => adjustAppreciation(-0.1)} className="flex-1 bg-white hover:bg-emerald-100 text-emerald-700 p-2 rounded-xl border border-emerald-200 shadow-sm active:scale-95 transition-all"><Minus size={14} className="mx-auto" /></button>
                            <button onClick={() => adjustAppreciation(0.1)} className="flex-1 bg-white hover:bg-emerald-100 text-emerald-700 p-2 rounded-xl border border-emerald-200 shadow-sm active:scale-95 transition-all"><Plus size={14} className="mx-auto" /></button>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center px-2 text-slate-500"><span>ローン控除による還付累計</span><span className="font-bold text-emerald-600">+{formatCurrency(results.totalMortgageTaxCredit)}</span></div>
                      <div className="pt-3 border-t-2 border-emerald-200 flex justify-between items-center mt-auto text-emerald-800 font-black"><span>② すべての収入合計</span><span className="text-xl">{formatCurrency(bucket2_gains)}</span></div>
                    </div>
                  </div>
                </div>

                {/* 最終純損益 */}
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><Scale size={120} /></div>
                  <div className="space-y-2 mb-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Net Wealth Creation</p>
                    <h4 className="text-2xl font-black">資産形成の最終結果</h4>
                    <div className="flex items-center justify-center gap-1 group relative cursor-help">
                      <span className="text-[10px] text-slate-400 font-bold underline decoration-dotted">この数字が意味すること</span>
                      <HelpCircle size={10} className="text-slate-500" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-4 bg-white text-slate-900 text-[10px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-2xl text-left leading-relaxed border border-slate-200">
                        <p className="font-black mb-2 text-blue-600">【資産形成の最終結果とは？】</p>
                        <p className="mb-2">「購入して住み、売却した時」に、最終的に手元にいくら残るか（または持ち出しになるか）を示す指標です。</p>
                        <ul className="space-y-1 list-disc pl-3">
                          <li><span className="font-bold">プラスの場合：</span>住居費をすべて支払った上で、さらに手元にお金が残る「貯金」に近い状態です。</li>
                          <li><span className="font-bold">マイナスの場合：</span>その金額分が、期間中の「実質的な住居コスト」となります。</li>
                        </ul>
                        <p className="mt-2 text-slate-500 italic">※賃貸で同期間住んだ場合の総コストと比較することで、購入の経済的メリットを判断できます。</p>
                      </div>
                    </div>
                    <span className={`text-6xl font-black tracking-tighter mt-4 block ${netInvestmentResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(netInvestmentResult)}</span>
                    
                    {/* 内訳詳細の追加 */}
                    <div className="mt-8 w-full max-w-md mx-auto bg-white/5 rounded-2xl p-6 text-left border border-white/10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">収支の内訳（シミュレーション期間合計）</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-emerald-400">
                          <span>売却時手残り（現金回収）</span>
                          <span className="font-bold">+{formatCurrency(results.sellingPrice - results.remainingMortgageBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-400">
                          <span>住宅ローン控除還付</span>
                          <span className="font-bold">+{formatCurrency(results.totalMortgageTaxCredit)}</span>
                        </div>
                        <div className="h-px bg-white/10 my-2" />
                        <div className="flex justify-between items-center text-rose-400">
                          <span>初期費用（頭金＋諸経費）</span>
                          <span className="font-bold">-{formatCurrency(inputs.downPayment + results.initialTotalCost)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-2">
                          内 現住居からの引越費用: {formatCurrency(results.initialMovingCosts)}
                        </div>
                        <div className="flex justify-between items-center text-rose-400">
                          <span>ローン返済・維持費・税金累計</span>
                          <span className="font-bold">-{formatCurrency(results.totalMortgagePayments + results.totalMaintenanceCosts + results.totalTaxPaid)}</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-400">
                          <span>売却時諸費用・譲渡税</span>
                          <span className="font-bold">-{formatCurrency(results.sellingCosts + results.taxAmount)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-2">
                          内 売却後の引越費用: {formatCurrency(results.exitMovingCosts)}
                        </div>
                        <div className="h-px bg-white/20 my-2" />
                        <div className={`flex justify-between items-center font-black text-sm ${netInvestmentResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span>最終純損益</span>
                          <span>{formatCurrency(netInvestmentResult)}</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-4 leading-relaxed italic">
                        ※売却時に手元に現金（売却時手残り）が残っても、それまでに支払った頭金や月々の返済額の合計がそれを上回る場合、トータルの収支はマイナスとなります。
                      </p>
                    </div>
                  </div>
                  {/* 購入 vs 同レベル賃貸の比較サマリー */}
                  <div className="w-full border-t border-white/10 pt-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black uppercase text-blue-400 tracking-widest flex items-center gap-1.5">
                          <ArrowRightLeft size={14} />
                          <span>購入 vs 同レベル賃貸（{inputs.yearsHeld}年間）の比較結果</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isEstimatingRent && inputs.estimatedMonthlyRent === 0 ? (
                            "AIがリアルタイムに周辺の類似分譲賃貸相場（SUUMO等）を自動検索中..."
                          ) : (
                            `購入物件と同等スペックの部屋（想定家賃: ${formatCurrency(inputs.estimatedMonthlyRent)}/月）に同期間賃貸で住んだ場合との比較`
                          )}
                        </p>
                      </div>
                    </div>

                    {/* 勝敗判定バッジ */}
                    {isEstimatingRent && inputs.estimatedMonthlyRent === 0 ? (
                      <div className="bg-indigo-950/60 border border-indigo-500/40 p-6 rounded-2xl text-center shadow-lg space-y-2 animate-pulse">
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-indigo-400" />
                          <span>AIが周辺の同等分譲賃貸相場を初回Webリサーチ中...</span>
                        </span>
                        <p className="text-xs text-slate-300">
                          SUUMOやHOME'S等の直近募集事例から同スペック物件の適正相場を自動取得しています。完了次第、損益分岐点が表示されます。
                        </p>
                      </div>
                    ) : results.buyVsRentDifference >= 0 ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl text-center shadow-lg">
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block mb-1">
                          👑 判定：購入の方が経済的メリット大
                        </span>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                          同等賃貸より 約 {formatCurrency(Math.round(results.buyVsRentDifference))} おトク
                        </p>
                        <p className="text-xs text-slate-300 mt-1">
                          {inputs.yearsHeld}年後に想定売却した場合、月額換算で約 <span className="font-bold text-white">{formatCurrency(Math.round(results.buyVsRentDifference / (inputs.yearsHeld * 12)))}/月</span> の住居費削減効果があります。
                        </p>
                      </div>
                    ) : (
                      <div className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl text-center shadow-lg">
                        <span className="text-xs font-black text-rose-400 uppercase tracking-widest block mb-1">
                          🏠 判定：賃貸の方が経済的メリット大
                        </span>
                        <p className="text-2xl sm:text-3xl font-black text-rose-400">
                          購入より賃貸の方が 約 {formatCurrency(Math.round(Math.abs(results.buyVsRentDifference)))} おトク
                        </p>
                        <p className="text-xs text-slate-300 mt-1">
                          価格の下落や売却諸経費を考慮すると、同等の賃貸に住み続けた方が月額換算で約 <span className="font-bold text-white">{formatCurrency(Math.round(Math.abs(results.buyVsRentDifference) / (inputs.yearsHeld * 12)))}/月</span> 負担が少なくなります。
                        </p>
                      </div>
                    )}

                    {/* 比較カード */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      {/* 購入側 */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                          <span className="text-xs font-black text-blue-400 uppercase">購入時の実質総負担額</span>
                          <span className="text-[10px] text-slate-400">({inputs.yearsHeld}年保有＋売却時)</span>
                        </div>
                        <div className="text-3xl font-black text-white">
                          {formatCurrency(results.netCostBuy)}
                        </div>
                        <div className="text-xs text-slate-300 flex justify-between">
                          <span>月割実質コスト:</span>
                          <span className="font-bold text-blue-300">{formatCurrency(realMonthlyCost)}/月</span>
                        </div>
                        <div className="text-[10px] text-slate-400 leading-relaxed pt-2 border-t border-white/10 space-y-1">
                          <p>※頭金＋諸経費＋ローン返済＋管理・修繕・税金＋売却経費－（売却手残り＋住宅ローン減税）</p>
                          <p className="text-indigo-300">
                            🚚 <span className="font-bold">引越し費用計上済み:</span> 入居時 {formatCurrency(results.initialMovingCosts)} ＋ 売却退去時 {formatCurrency(results.exitMovingCosts)}
                          </p>
                        </div>
                      </div>

                      {/* 同等賃貸側 */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                          <span className="text-xs font-black text-purple-400 uppercase">同等賃貸の総支出</span>
                          <span className="text-[10px] text-slate-400">
                            {isEstimatingRent && inputs.estimatedMonthlyRent === 0 ? "(AI自動リサーチ中...)" : `(想定 ${formatCurrency(inputs.estimatedMonthlyRent)}/月)`}
                          </span>
                        </div>
                        {isEstimatingRent && inputs.estimatedMonthlyRent === 0 ? (
                          <div className="py-6 text-center space-y-2">
                            <Loader2 size={24} className="animate-spin text-purple-400 mx-auto" />
                            <p className="text-xs text-slate-300 font-bold">SUUMO等の募集相場を初回自動検索中...</p>
                            <p className="text-[10px] text-slate-400">事例と参照URLを取得しています</p>
                          </div>
                        ) : (
                          <>
                            <div className="text-3xl font-black text-white">
                              {formatCurrency(results.totalRentalCost)}
                            </div>
                            <div className="text-xs text-slate-300 flex justify-between">
                              <span>月割実質コスト:</span>
                              <span className="font-bold text-purple-300">{formatCurrency(Math.round(results.totalRentalCost / (inputs.yearsHeld * 12)))}/月</span>
                            </div>
                            <div className="text-[10px] text-slate-400 leading-relaxed pt-2 border-t border-white/10 space-y-1">
                              <p>※初期費用（約3.5ヶ月分）＋月額家賃累計（{inputs.yearsHeld}年間）＋2年ごとの更新料累計</p>
                              {inputs.estimatedRentSources && inputs.estimatedRentSources.length > 0 && (
                                <div className="pt-1">
                                  <span className="text-indigo-300 font-bold block mb-1">🔗 算定根拠リンク:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {inputs.estimatedRentSources.slice(0, 3).map((src, i) => (
                                      <a 
                                        key={i} 
                                        href={src.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="bg-white/10 hover:bg-white/20 text-indigo-200 px-1.5 py-0.5 rounded text-[9px] inline-flex items-center gap-0.5 underline truncate max-w-[160px]"
                                      >
                                        <span className="truncate">{src.title || src.uri}</span>
                                        <ExternalLink size={8} className="shrink-0" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 参考：現在の家賃を継続した場合 */}
                    <div className="pt-2 text-center text-xs text-slate-400">
                      <span>参考（現状維持）： 現在の家賃（{formatCurrency(inputs.currentMonthlyRent)}/月）に住み続けた場合の{inputs.yearsHeld}年累計支出 ＝ 約 </span>
                      <span className="font-bold text-slate-200">{formatCurrency(Math.round(totalMonthlyRental * inputs.yearsHeld * 12))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* AIハザード・立地診断 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Waves className="w-5 h-5 text-blue-600" />
                    <h3 className="font-black text-slate-800">立地ハザード評価</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => fetchHazardOnly()} 
                    disabled={loadingHazard}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 p-1.5 rounded-lg hover:bg-blue-50 transition-colors active:scale-95 disabled:opacity-40"
                    title="ハザード情報を再取得"
                  >
                    <RefreshCcw size={13} className={loadingHazard ? "animate-spin" : ""} />
                    <span>再取得</span>
                  </button>
                </div>
                <div className="text-sm text-slate-600 bg-slate-50 p-6 rounded-2xl border border-slate-100 min-h-[120px] whitespace-pre-wrap leading-relaxed">
                  {loadingHazard ? (
                    <div className="py-8 text-center text-slate-400">
                      <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" />
                      <p className="text-xs font-bold">自治体の水害・土砂災害ハザード情報をGoogle検索で取得中...</p>
                    </div>
                  ) : hazardInfo ? (
                    <>
                      <div>{hazardInfo.text}</div>
                      {hazardInfo.sources && hazardInfo.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">参照ソース:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {hazardInfo.sources.map((src, idx) => (
                              <a 
                                key={idx} 
                                href={src.uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[10px] bg-white border border-slate-200 text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:border-blue-300"
                              >
                                {src.title || src.uri} <ExternalLink size={9} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      <p className="font-bold text-xs">物件住所を入力するか、「再取得」を押してハザード情報を解析してください。</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-amber-600" />
                    <h3 className="font-black text-slate-800">出口戦略・将来相場</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => fetchExitOnly()} 
                    disabled={loadingExit}
                    className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 p-1.5 rounded-lg hover:bg-amber-50 transition-colors active:scale-95 disabled:opacity-40"
                    title="出口相場データを再取得"
                  >
                    <RefreshCcw size={13} className={loadingExit ? "animate-spin" : ""} />
                    <span>再取得</span>
                  </button>
                </div>
                <div className="text-sm text-slate-600 bg-slate-50 p-6 rounded-2xl border border-slate-100 min-h-[120px] whitespace-pre-wrap leading-relaxed">
                  {loadingExit ? (
                    <div className="py-8 text-center text-slate-400">
                      <Loader2 className="animate-spin mx-auto text-amber-500 mb-2" />
                      <p className="text-xs font-bold">今から{inputs.yearsHeld}年後の周辺中古成約相場・事例を調査中...</p>
                    </div>
                  ) : exitStrategy ? (
                    <>
                      <div>{exitStrategy.text}</div>
                      {exitStrategy.sources && exitStrategy.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">参照ソース:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {exitStrategy.sources.map((src, idx) => (
                              <a 
                                key={idx} 
                                href={src.uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[10px] bg-white border border-slate-200 text-amber-600 hover:text-amber-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:border-amber-300"
                              >
                                {src.title || src.uri} <ExternalLink size={9} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      <p className="font-bold text-xs">物件住所を入力するか、「再取得」を押して将来相場事例を解析してください。</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SUUMO物件「落とし穴」徹底スクリーニング */}
            <section className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xl font-black text-slate-800">AI物件「落とし穴」徹底スクリーニング</h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">修繕積立金の妥当性、立地、重要制限事項、施工・管理会社、専有部仕様から隠れたリスクを診断</p>
                  </div>
                </div>
                <button type="button" onClick={runPitfallsAnalysis} disabled={loadingPitfalls} className="no-print bg-amber-600 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-amber-700 disabled:bg-amber-400 transition-all shadow-md hover:shadow-amber-100 active:scale-95 self-start sm:self-auto shrink-0">
                  {loadingPitfalls ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} className="fill-current" />} 落とし穴チェックを実行
                </button>
              </div>
              <div className="text-sm leading-relaxed text-slate-700 min-h-[150px] whitespace-pre-wrap bg-slate-50 p-8 rounded-[1.5rem] shadow-inner border border-slate-100">
                {propertyPitfalls ? (
                  propertyPitfalls
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    <ShieldAlert size={40} className="mx-auto mb-3 opacity-20 text-amber-500 animate-pulse" />
                    <p className="font-bold text-sm">「落とし穴チェックを実行」ボタンを押すと、AIが物件データを徹底検証します。</p>
                    <p className="text-xs mt-1 text-slate-400">（SUUMO等のURLを登録している場合は、ページ内の情報も併せて徹底精査します）</p>
                  </div>
                )}
              </div>
            </section>

            {/* 比較検討リスト */}
            {savedSimulations.length > 0 && (
              <section className="no-print space-y-6 pt-10 border-t border-slate-200">
                <div className="flex items-center justify-between"><h3 className="text-xl font-black text-slate-800">比較検討リスト</h3><span className="text-xs text-slate-400 font-bold">{savedSimulations.length} 件保存中</span></div>
                <div className="flex overflow-x-auto gap-6 pb-6 snap-x">
                  {savedSimulations.map((save) => (
                    <div key={save.id} className="min-w-[320px] bg-white rounded-3xl border border-slate-200 shadow-sm p-6 snap-start flex flex-col hover:border-blue-300 transition-colors group">
                      <div className="flex justify-between items-start mb-4"><div className="flex-1"><h4 className="font-black text-slate-800 text-lg truncate pr-2">{save.name}</h4><span className="text-[10px] text-slate-400 font-bold">{new Date(save.timestamp).toLocaleString()}</span></div><button onClick={() => handleDeleteSimulation(save.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Trash2 size={16} /></button></div>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-xl p-3 text-xs"><span>利益</span><p className={`font-black ${save.results.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(save.results.netProfit)}</p></div>
                        <div className="bg-slate-50 rounded-xl p-3 text-xs"><span>月間負担</span><p className="font-black text-slate-800">{formatCurrency(save.results.monthlyHousingCost)}</p></div>
                      </div>
                      <button onClick={() => handleLoadSimulation(save)} className="mt-auto w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 group-hover:bg-blue-600 transition-all"><Copy size={14} /> 条件を読み込んで再解析</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* PDF診断レポートモーダル */}
      <PdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        inputs={inputs}
        results={results}
        hazardInfo={hazardInfo}
        exitStrategy={exitStrategy}
        propertyPitfalls={propertyPitfalls}
      />
    </div>
  );
};

export default App;
