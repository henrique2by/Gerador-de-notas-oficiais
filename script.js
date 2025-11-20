document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando gerador de PDF...');

  const generateBtn = document.getElementById('generatePdf');
  const pdfContent = document.getElementById('pdf-content');
  
  // Elementos do Editor Rico
  const bodyEditor = document.getElementById('body');
  const alignCenterBtn = document.getElementById('alignCenterBtn');

  if (!generateBtn || !pdfContent || !bodyEditor) {
    alert('Erro: elementos essenciais não encontrados.');
    return;
  }
  
  // LÓGICA DO BOTÃO CENTRALIZAR PARA EDITOR RICO
  if (alignCenterBtn) {
    alignCenterBtn.addEventListener('click', () => {
        // Aplica o comando nativo do navegador para centralizar o bloco selecionado (parágrafo)
        document.execCommand('justifyCenter', false, null);
        
        // Dá um feedback visual básico ao botão
        alignCenterBtn.classList.toggle('active');
    });
  }

  // --- Funções de Suporte (Inalteradas) ---

  async function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    if (imgs.length === 0) return Promise.resolve();
    const list = imgs.map(img => new Promise(res => {
      if (!img.src) return res();
      if (img.complete && img.naturalWidth > 0) return res();
      img.onload = () => res();
      img.onerror = () => {
        console.warn('Imagem não carregou (ignorando):', img.src);
        res();
      };
      setTimeout(() => { res(); }, 5000);
    }));
    return Promise.all(list);
  }

  function getJsPDFClass() {
    return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  }

  // --- LÓGICA DE CÁLCULO DO CÓDIGO DO DEPARTAMENTO (MAIS ROBUSTA) ---
  function getDepartmentCode(departmentName) {
    // 1. Remove espaços em branco
    // 2. Remove acentos (ex: "é" vira "e")
    // 3. Converte para maiúsculas
    const normalizedName = departmentName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    // Apenas se o nome *incluir* uma das frases-chave, retornará GP
    if (normalizedName.includes('GABINETE DO PRESIDENTE') || 
        normalizedName.includes('GABINETE DE APOIO AO PRESIDENTE')) {
      return 'GP';
    }
    // Valor padrão (qualquer outra coisa)
    return 'CMM';
  }
  // ----------------------------------------------------------------------

  // --- Listener Principal para Geração do PDF ---

  generateBtn.addEventListener('click', async () => {
    try {
      console.log('Geração iniciada...');
      
      // LEITURA DOS CAMPOS
      const department = document.getElementById('department').value.trim();
      const recipient = document.getElementById('recipient').value.trim();
      const refNumber = document.getElementById('refNumber').value.trim(); 
      const subject = document.getElementById('subject').value.trim();
      const bodyHTML = bodyEditor.innerHTML.trim();

      // Validação
      if (!department || !recipient || !refNumber || !subject || !bodyHTML || bodyHTML === '<br>' || bodyHTML === '<p><br></p>') {
        alert('Preencha todos os campos obrigatórios.');
        return;
      }

      // VARIÁVEIS DE DATA E CÓDIGO CALCULADO
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
      const year = now.getFullYear(); 

      const manualRefNumber = refNumber.trim().toUpperCase(); 
      
      // *** CÁLCULO AUTOMÁTICO DO CÓDIGO DO DEPARTAMENTO ***
      const manualDepartmentCode = getDepartmentCode(department);
      
      // Preenche layout do PDF (campos internos)
      pdfContent.querySelector('.department').textContent = department.toUpperCase();
      pdfContent.querySelector('.recipient').innerHTML = recipient.replace(/\n/g, '<br>');
      
      // N. Refª no PDF: [refNumber]/[departmentCode]/[ano]
      pdfContent.querySelector('.ref').textContent = `N. Refª ${manualRefNumber}/${manualDepartmentCode}/${year}`; 
      
      // Código no meio da página usa o Código do Departamento (Calculado)
      pdfContent.querySelector('.code').textContent = manualDepartmentCode;
      
      pdfContent.querySelector('.date').textContent = `Data: ${dateStr}`;
      pdfContent.querySelector('.subject').textContent = subject.toUpperCase();
      
      // Passa o HTML formatado
      pdfContent.querySelector('.body-text').innerHTML = bodyHTML; 

      // ... (Lógica de Geração e Download do PDF) ...
      pdfContent.style.display = 'block';
      pdfContent.style.left = '0px';

      await waitForImages(pdfContent);

      if (!window.html2canvas) throw new Error('html2canvas não encontrado.');
      const jsPDFClass = getJsPDFClass();
      if (!jsPDFClass) throw new Error('jsPDF não encontrado.');

      const canvas = await html2canvas(pdfContent, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF'
      });

      const { jsPDF } = window.jspdf || { jsPDF: jsPDFClass };
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (pageW - imgW) / 2;
      const y = 0;

      pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', x, y, imgW, imgH);

      // Nome do arquivo final: N.O._[refNumber]_[departmentCode].pdf
      const filename = `N.O._${manualRefNumber}_${manualDepartmentCode}.pdf`; 

      try {
        pdf.save(filename);
      } catch (errSave) {
        // Fallback
        try {
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 20000);
        } catch (errBlob) {
          alert('Falha ao efetuar download do PDF.');
        }
      }

    } catch (err) {
      console.error('Erro durante geração do PDF:', err);
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      // Oculta o conteúdo novamente (limpeza)
      pdfContent.style.display = 'none';
      pdfContent.style.left = '-9999px';
    }
  });
});