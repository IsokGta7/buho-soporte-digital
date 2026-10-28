
import { toast } from 'sonner';

// jspdf (with html2canvas behind it), jspdf-autotable and xlsx are large and
// only needed when someone exports, so they are loaded on first use instead of
// being part of the main bundle.

export interface ExportColumn {
  /** Column title printed in the PDF. */
  header: string;
  /** Property of each row that holds the value. */
  key: string;
}

// Función para exportar a CSV
export const exportToCSV = async (data: any[], fileName: string) => {
  try {
    const XLSX = await import('xlsx');

    // Crear un libro de trabajo
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Añadir la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    // Escribir el archivo y descargarlo
    XLSX.writeFile(workbook, `${fileName}.csv`);

    toast.success('Archivo CSV descargado exitosamente');
  } catch (error) {
    console.error('Error al exportar a CSV:', error);
    toast.error('Error al generar el archivo CSV');
  }
};

// Función para exportar a PDF
export const exportToPDF = async (data: any[], fileName: string, columns: ExportColumn[]) => {
  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text(fileName, 14, 22);

    // Añadir fecha
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

    // Crear tabla
    const tableColumn = columns.map((column) => column.header);
    const tableRows: any[][] = data.map((item) =>
      columns.map((column) => item[column.key] ?? '-')
    );

    // Añadir tabla usando jspdf-autotable
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    // Guardar el PDF
    doc.save(`${fileName}.pdf`);

    toast.success('Archivo PDF descargado exitosamente');
  } catch (error) {
    console.error('Error al exportar a PDF:', error);
    toast.error('Error al generar el archivo PDF');
  }
};
