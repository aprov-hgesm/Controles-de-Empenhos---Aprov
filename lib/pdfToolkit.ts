export async function loadJsPdf() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

export async function loadJsPdfWithAutoTable() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  return { jsPDF, autoTable };
}
