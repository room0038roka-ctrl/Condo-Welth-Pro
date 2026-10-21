import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportData {
  elementId: string;
  fileName?: string;
  onProgress?: (status: string) => void;
}

/**
 * 対象のHTMLエレメントを高解像度キャンバス化し、A4サイズのPDFとしてダウンロードする
 */
export const exportElementToPdf = async ({
  elementId,
  fileName = 'condo_simulation_report.pdf',
  onProgress
}: PdfExportData): Promise<boolean> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`対象のエレメント (#${elementId}) が見つかりませんでした。`);
  }

  try {
    if (onProgress) onProgress('レポート画面を高解像度キャプチャ中...');

    // 一時的にスタイル調整して高精細キャプチャ
    const canvas = await html2canvas(element, {
      scale: 2, // 鮮明な2倍解像度
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    if (onProgress) onProgress('PDFドキュメントを生成中...');

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // A4サイズ（縦向き: 210mm x 297mm）
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // A4幅に合わせた画像の高さ（mm換算）
    const imgHeightMm = (canvasHeight * pdfWidth) / canvasWidth;

    let heightLeft = imgHeightMm;
    let position = 0;

    // 1ページ目
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightMm);
    heightLeft -= pdfHeight;

    // コンテンツがA4縦1ページを超える場合は自動改ページ
    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightMm);
      heightLeft -= pdfHeight;
    }

    if (onProgress) onProgress('PDFファイルをダウンロード中...');
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  }
};
