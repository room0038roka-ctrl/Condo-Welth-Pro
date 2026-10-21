import React, { useRef, useState } from 'react';
import { SimulationInputs, SimulationResults } from '../types';
import { formatCurrency } from '../utils/calculations';
import { exportElementToPdf } from '../utils/pdfGenerator';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  CheckCircle2, 
  TrendingUp, 
  Building2, 
  Calendar, 
  MapPin, 
  ExternalLink,
  ShieldAlert,
  Waves,
  Sparkles,
  Loader2,
  AlertTriangle,
  Scale
} from 'lucide-react';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: SimulationInputs;
  results: SimulationResults;
  hazardInfo: { text: string; sources: any[] } | null;
  exitStrategy: { text: string; sources: any[] } | null;
  propertyPitfalls: string | null;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  inputs,
  results,
  hazardInfo,
  exitStrategy,
  propertyPitfalls
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportStatus('PDFを準備中...');

    try {
      const sanitizedName = (inputs.propertyName || '物件シミュレーション')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim();
      const fileName = `${sanitizedName}_収支診断レポート_${new Date().toISOString().slice(0, 10)}.pdf`;

      await exportElementToPdf({
        elementId: 'pdf-printable-report',
        fileName,
        onProgress: (msg) => setExportStatus(msg)
      });
    } catch (err: any) {
      console.error(err);
      setExportError('PDF生成中にエラーが発生しました。ブラウザの印刷機能をお試しください。');
    } finally {
      setIsExporting(false);
      setExportStatus('');
    }
  };

  const handleNativePrint = () => {
    try {
      window.print();
    } catch (e) {
      alert('iframe環境のため直接印刷が制限されています。「PDFをダウンロード」ボタンをご利用ください。');
    }
  };

  const netInvestmentResult = results.netProfit;
  const isBuyAdvantage = results.buyVsRentDifference >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600 w-5 h-5" />
            <h2 className="font-bold text-slate-800 text-base sm:text-lg">
              マンション購入・賃貸比較 診断レポート (PDF)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{exportStatus || '生成中...'}</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>PDFをダウンロード</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleNativePrint}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
              title="ブラウザ印刷ダイアログ（利用可能な環境のみ）"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">印刷</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {exportError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {/* プレビュー表示エリア（スクロール可能） */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          
          {/* 実際のPDF出力対象エレメント (#pdf-printable-report) */}
          <div 
            id="pdf-printable-report" 
            className="w-full max-w-[800px] bg-white p-8 sm:p-10 shadow-lg border border-slate-200 text-slate-800 space-y-6 rounded-xl"
            style={{ minHeight: '1050px', boxSizing: 'border-box' }}
          >
            {/* レポート表題部 */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">
                  CONDO WEALTH PRO SIMULATION REPORT
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {inputs.propertyName || '分譲マンション'} 収支診断レポート
                </h1>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1"><MapPin size={12} /> {inputs.propertyAddress || '住所未設定'}</span>
                  <span>|</span>
                  <span className="flex items-center gap-1"><Calendar size={12} /> 作成日: {new Date().toLocaleDateString('ja-JP')}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg">
                  シミュレーション期間: {inputs.yearsHeld}年
                </span>
              </div>
            </div>

            {/* 判定サマリーバッジ */}
            <div className={`p-5 rounded-xl border-2 text-center ${
              isBuyAdvantage 
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950' 
                : 'bg-rose-50 border-rose-400 text-rose-950'
            }`}>
              <span className="text-xs font-black uppercase tracking-wider block mb-1">
                {isBuyAdvantage ? '👑 診断結果：同等賃貸より購入の方が経済的メリット大' : '🏠 診断結果：購入より同等賃貸の方が経済的メリット大'}
              </span>
              <p className="text-3xl font-black tracking-tight">
                {isBuyAdvantage
                  ? `同等賃貸より 約 ${formatCurrency(Math.round(results.buyVsRentDifference))} おトク`
                  : `賃貸の方が 約 ${formatCurrency(Math.round(Math.abs(results.buyVsRentDifference)))} おトク`
                }
              </p>
              <p className="text-xs mt-1 font-medium opacity-85">
                {inputs.yearsHeld}年後に想定売却した場合の月割差額: 約 {formatCurrency(Math.round(Math.abs(results.buyVsRentDifference) / (inputs.yearsHeld * 12)))}/月
              </p>
            </div>

            {/* 基本スペック・前提条件 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">物件購入価格</span>
                <span className="text-base font-black text-slate-800">{formatCurrency(inputs.purchasePrice)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">専有面積 / 築年数</span>
                <span className="text-sm font-bold text-slate-800">{inputs.areaSize}㎡ / 築{inputs.buildingAge}年</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">ローン借入額 / 金利</span>
                <span className="text-sm font-bold text-slate-800">
                  {formatCurrency(inputs.purchasePrice - inputs.downPayment)} / {inputs.interestRate}%
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">予想価格変動率</span>
                <span className="text-sm font-bold text-slate-800">年 {inputs.appreciationRate > 0 ? `+${inputs.appreciationRate}` : inputs.appreciationRate}%</span>
              </div>
            </div>

            {/* 購入 vs 同等賃貸 比較対照表 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2 text-xs font-bold flex justify-between">
                <span>【{inputs.yearsHeld}年間の総収支・負担額比較】</span>
                <span>比較対象賃料: {formatCurrency(inputs.estimatedMonthlyRent)}/月</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-200 text-xs">
                {/* 購入側 */}
                <div className="p-4 space-y-2 bg-blue-50/40">
                  <div className="flex justify-between items-center border-b border-blue-200 pb-1 font-bold text-blue-900">
                    <span>🏢 購入・保有・売却</span>
                    <span>実質負担額: {formatCurrency(results.netCostBuy)}</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>頭金:</span>
                      <span className="font-bold">{formatCurrency(inputs.downPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>購入時諸経費:</span>
                      <span className="font-bold">{formatCurrency(results.initialTotalCost)}</span>
                    </div>
                    <div className="flex justify-between pl-2 text-[10px] text-slate-500">
                      <span>・現住居からの引越し代:</span>
                      <span>{formatCurrency(results.initialMovingCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{inputs.yearsHeld}年間ローン返済累計:</span>
                      <span className="font-bold">{formatCurrency(results.totalMortgagePayments)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>管理費・修繕積立金・固定資産税累計:</span>
                      <span className="font-bold">{formatCurrency(results.totalMaintenanceCosts + results.totalTaxPaid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>売却時諸費用・譲渡税:</span>
                      <span className="font-bold">{formatCurrency(results.sellingCosts + results.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between pl-2 text-[10px] text-slate-500">
                      <span>・売却後引越し代:</span>
                      <span>{formatCurrency(results.exitMovingCosts)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                      <span>売却時回収額（手残り＋減税）:</span>
                      <span>-{formatCurrency((results.sellingPrice - results.remainingMortgageBalance) + results.totalMortgageTaxCredit)}</span>
                    </div>
                  </div>
                </div>

                {/* 賃貸側 */}
                <div className="p-4 space-y-2 bg-purple-50/40">
                  <div className="flex justify-between items-center border-b border-purple-200 pb-1 font-bold text-purple-900">
                    <span>🏠 同等賃貸に居住</span>
                    <span>総支出: {formatCurrency(results.totalRentalCost)}</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>入居時初期費用 (約3.5ヶ月分):</span>
                      <span className="font-bold">{formatCurrency(Math.round(inputs.estimatedMonthlyRent * 3.5))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{inputs.yearsHeld}年間の家賃累計:</span>
                      <span className="font-bold">{formatCurrency(inputs.estimatedMonthlyRent * 12 * inputs.yearsHeld)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>更新料累計 (2年毎 1ヶ月分):</span>
                      <span className="font-bold">{formatCurrency(Math.floor((inputs.yearsHeld - 1) / 2) * inputs.estimatedMonthlyRent)}</span>
                    </div>
                    <div className="pt-4 text-[10px] text-slate-500 leading-relaxed">
                      ※同物件スペック（{inputs.areaSize}㎡）に相当する賃貸相場（{formatCurrency(inputs.estimatedMonthlyRent)}/月）で試算。資産形成効果（売却手残り）はありません。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 賃料算定根拠・事例 */}
            {inputs.estimatedRentReasoning && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500" />
                  <span>AIによる賃料算定根拠（Webリサーチ結果）:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">{inputs.estimatedRentReasoning}</p>
                {inputs.estimatedRentExamples && inputs.estimatedRentExamples.length > 0 && (
                  <div className="pt-1 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">参照した募集事例:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {inputs.estimatedRentExamples.slice(0, 2).map((ex, idx) => (
                        <div key={idx} className="p-1.5 bg-white border border-slate-200 rounded text-[10px] flex justify-between">
                          <span className="font-bold truncate">{ex.propertyName}</span>
                          <span className="text-emerald-700 font-bold shrink-0">{ex.rentText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 年次推移ダイジェスト表 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-1.5 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                資産価値とローン残債の年次推移
              </div>
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-2">経過年数</th>
                    <th className="p-2">想定資産価値</th>
                    <th className="p-2">ローン残債</th>
                    <th className="p-2">含み益(純資産)</th>
                    <th className="p-2">購入累計支出</th>
                    <th className="p-2">賃貸累計支出</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.yearlyData
                    .filter((d, i) => i === 1 || i === 3 || i === 5 || i === 10 || i === inputs.yearsHeld)
                    .map((d) => (
                      <tr key={d.year} className={d.year === inputs.yearsHeld ? 'bg-blue-50/60 font-bold' : ''}>
                        <td className="p-2">{d.year}年目 {d.year === inputs.yearsHeld ? '(売却時)' : ''}</td>
                        <td className="p-2">{formatCurrency(Math.round(d.propertyValue))}</td>
                        <td className="p-2">{formatCurrency(Math.round(d.mortgageBalance))}</td>
                        <td className={`p-2 ${d.equity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(Math.round(d.equity))}
                        </td>
                        <td className="p-2">{formatCurrency(Math.round(d.cumulativeCost))}</td>
                        <td className="p-2">{formatCurrency(Math.round(d.cumulativeRentalCost))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* AIハザード・立地評価（取得済みの場合） */}
            {hazardInfo && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <Waves size={12} className="text-blue-600" />
                  <span>立地ハザード評価（水害・土砂・地盤）:</span>
                </div>
                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{hazardInfo.text}</p>
              </div>
            )}

            {/* フッター注記 */}
            <div className="pt-2 border-t border-slate-200 text-[9px] text-slate-400 text-center leading-relaxed">
              ※本診断レポートは試算モデルに基づくシミュレーションであり、将来の不動産価格、金利変動、実際の税額を保証するものではありません。
            </div>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
          <span>※PDFはA4縦サイズで直接ダウンロードされます。</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
