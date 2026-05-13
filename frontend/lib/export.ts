import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportPredictionsAsPDF(subject: string, year: number, containerId: string) {
  const element = document.getElementById(containerId)
  if (!element) return

  const canvas = await html2canvas(element, {
    backgroundColor: '#050508',
    scale: 1.5,
    logging: false,
    useCORS: true,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 10
  const imgWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  pdf.setFontSize(14)
  pdf.text(`ExamPredictor — ${subject} ${year} Predictions`, margin, 14)
  pdf.addImage(imgData, 'PNG', margin, 22, imgWidth, imgHeight)
  pdf.save(`predictions-${subject}-${year}.pdf`)
}