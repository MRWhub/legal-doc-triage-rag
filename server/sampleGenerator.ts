import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SampleDocumentInfo } from '../src/types.ts';

interface SampleDocumentBlueprint extends SampleDocumentInfo {
  headerTitle: string;
  headerSubtitle: string;
  pages: Array<{
    sectionTitle: string;
    paragraphs: string[];
  }>;
}

const SAMPLE_BLUEPRINTS: SampleDocumentBlueprint[] = [
  {
    slug: 'intimacao-prazo-critico',
    filename: 'intimacao-prazo-critico.pdf',
    title: 'Intimação Judicial — Cumprimento de Sentença',
    category: 'Intimação Judicial',
    expectedUrgency: 'ALTA',
    hasCnj: true,
    pageCount: 2,
    summary:
      'Prazo fatal de 5 dias úteis sob pena de multa diária de R$ 2.500,00 e bloqueio SISBAJUD no valor de R$ 184.750,00.',
    headerTitle: 'TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO',
    headerSubtitle: '14ª Vara Cível do Foro Central da Comarca de São Paulo — Processo Digital',
    pages: [
      {
        sectionTitle: 'MANDADO DE INTIMAÇÃO EM CUMPRIMENTO DE SENTENÇA (URGENTE)',
        paragraphs: [
          'Processo nº (CNJ): 0014829-42.2026.8.26.0100',
          'Classe: Cumprimento de Sentença — Obrigações Civis e Comerciais',
          'Exequente: Banco Atlântico S.A. (CNPJ 12.345.678/0001-90)',
          'Executada: Construtora Horizonte Ltda. (CNPJ 98.765.432/0001-10)',
          'Valor Atualizado da Execução: R$ 184.750,00 (cento e oitenta e quatro mil, setecentos e cinquenta reais), conforme memória de cálculo homologada em fls. 214.',
          'Fica a parte executada formalmente INTIMADA, na pessoa de seus patronos cadastrados nos autos, para que no prazo peremptório e improrrogável de 5 (cinco) dias úteis, contados da disponibilização desta intimação no Diário da Justiça Eletrônico, efetue o pagamento voluntário do débito exequendo ou apresente comprovante integral de quitação.',
          'Em razão da natureza urgente da medida e do descumprimento anterior do acordo homologado, o juízo determinou prioridade máxima de tramitação no cartório da 14ª Vara Cível.',
        ],
      },
      {
        sectionTitle: 'COMINAÇÕES LEGAIS, MULTA DIÁRIA E CONSTRIÇÃO PATRIMONIAL',
        paragraphs: [
          'Caso decorra o prazo de 5 (cinco) dias úteis sem o pagamento integral ou manifestação devidamente documentada, incidirão automaticamente as seguintes penalidades judiciais:',
          '1. Aplicação de multa processual de 10% (dez por cento) e honorários advocatícios de 10% sobre o saldo devedor, nos termos do art. 523, parágrafo 1º, do Código de Processo Civil.',
          '2. Incidência de multa diária (astreintes) no valor de R$ 2.500,00 (dois mil e quinhentos reais) por dia de descumprimento da obrigação acessória de exibição dos livros fiscais, limitada inicialmente a 30 dias.',
          '3. Expedição imediata de ordem de bloqueio eletrônico de ativos financeiros via sistema SISBAJUD e restrição de transferência de veículos via RENAJUD até o limite do crédito atualizado de R$ 184.750,00.',
          'São Paulo, 24 de novembro de 2026. Dra. Helena Vasconcelos — Juíza de Direito Titular da 14ª Vara Cível.',
        ],
      },
    ],
  },
  {
    slug: 'peticao-inicial-trabalhista',
    filename: 'peticao-inicial-trabalhista.pdf',
    title: 'Petição Inicial — Reclamação Trabalhista',
    category: 'Petição Inicial Trabalhista',
    expectedUrgency: 'MEDIA',
    hasCnj: true,
    pageCount: 3,
    summary:
      'Reclamação trabalhista de R$ 68.420,00 pleiteando horas extras, adicional de periculosidade e reflexos, com audiência prevista para 30 dias.',
    headerTitle: 'JUSTIÇA DO TRABALHO — TRIBUNAL REGIONAL DO TRABALHO DA 2ª REGIÃO',
    headerSubtitle: '38ª Vara do Trabalho de São Paulo — Rito Ordinário',
    pages: [
      {
        sectionTitle: 'PETIÇÃO INICIAL — RECLAMAÇÃO TRABALHISTA',
        paragraphs: [
          'Processo nº (CNJ): 0000912-88.2026.5.02.0038',
          'Reclamante: Carlos Eduardo Mendes, brasileiro, técnico de manutenção industrial, portador do CPF 321.654.987-00.',
          'Reclamada: Logística Express Brasil Ltda., pessoa jurídica de direito privado, inscrita no CNPJ 45.112.890/0001-44, com sede em Barueri/SP.',
          'I. DO CONTRATO DE TRABALHO: O Reclamante foi admitido em 10/03/2023 para exercer a função de Técnico de Manutenção de Frota, com último salário base mensal de R$ 4.850,00, tendo sido dispensado sem justa causa em 15/10/2026.',
          'Durante todo o pacto laboral, cumpriu jornada habitual das 07h00 às 18h30 de segunda a sexta-feira, com apenas 30 minutos de intervalo intrajornada, sem a correta contraprestação das horas extraordinárias laboradas.',
        ],
      },
      {
        sectionTitle: 'II. DOS PEDIDOS E FUNDAMENTAÇÃO JURÍDICA',
        paragraphs: [
          '1. Horas Extras e Intervalo Intrajornada: Requer o pagamento de aproximadamente 2 horas extras diárias com adicional normativo de 50% nos dias úteis e 100% aos domingos, acrescido de reflexos em DSR, férias + 1/3, 13º salário, aviso prévio e FGTS + 40%, totalizando R$ 39.200,00.',
          '2. Adicional de Periculosidade (30%): O Reclamante realizava abastecimento e manutenção diária junto ao tanque aéreo de óleo diesel de 15.000 litros no pátio da Reclamada, sem receber o adicional previsto no art. 193 da CLT. Valor estimado com reflexos: R$ 21.420,00.',
          '3. Diferenças de Verbas Rescisórias e Multa do art. 477 da CLT: O pagamento rescisório ocorreu com atraso de 6 dias após o prazo legal de 10 dias corridos, ensejando multa equivalente a um salário base (R$ 4.850,00) e diferenças salariais de R$ 2.950,00.',
        ],
      },
      {
        sectionTitle: 'III. DO VALOR DA CAUSA E REQUERIMENTOS FINAIS',
        paragraphs: [
          'Requer a notificação da Reclamada para apresentar defesa escrita até a data da audiência inaugural, estimada para ocorrer no prazo de 30 (trinta) dias a contar da citação inicial, sob pena de revelia e confissão quanto à matéria de fato.',
          'Requer ainda a designação de perícia técnica de engenharia de segurança do trabalho para apuração da periculosidade no local de trabalho.',
          'Dá-se à presente causa o valor total líquido estimado de R$ 68.420,00 (sessenta e oito mil, quatrocentos e vinte reais), conforme planilha demonstrativa anexa.',
          'Termos em que pede deferimento. São Paulo, 19 de novembro de 2026. Dr. Rafael Nogueira — OAB/SP 312.450.',
        ],
      },
    ],
  },
  {
    slug: 'contrato-comercial-servicos',
    filename: 'contrato-comercial-servicos.pdf',
    title: 'Contrato Comercial de Prestação de Serviços (Sem CNJ)',
    category: 'Contrato Comercial',
    expectedUrgency: 'BAIXA',
    hasCnj: false,
    pageCount: 3,
    summary:
      'Instrumento particular sem número CNJ, vigência de 24 meses, valor global de R$ 348.000,00 (R$ 14.500,00/mês) e multa rescisória de 20%.',
    headerTitle: 'INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA',
    headerSubtitle: 'Documento Extrajudicial — Departamento Jurídico Corporativo',
    pages: [
      {
        sectionTitle: 'QUALIFICAÇÃO DAS PARTES, OBJETO E PRAZO DE VIGÊNCIA',
        paragraphs: [
          'CONTRATANTE: Grupo Vértice Alimentos S.A., sociedade anônima inscrita no CNPJ 22.874.110/0001-65, com sede na Av. Batel, 1500, Curitiba/PR.',
          'CONTRATADA: DataCore Engenharia de Software Ltda., inscrita no CNPJ 33.410.992/0001-08, com sede na Rua XV de Novembro, 890, Curitiba/PR.',
          'CLÁUSULA 1ª (DO OBJETO): O presente contrato tem por objeto a prestação de serviços contínuos de sustentação, monitoramento de infraestrutura em nuvem e evolução de integrações ERP pela CONTRATADA em favor da CONTRATANTE.',
          'CLÁUSULA 2ª (DA VIGÊNCIA): O presente instrumento vigorará pelo prazo determinado de 24 (vinte e quatro) meses, com início em 01/12/2026 e término previsto para 30/11/2028, sendo renovável automaticamente por períodos iguais de 12 meses caso nenhuma das partes manifeste oposição formal por escrito com antecedência mínima de 60 (sessenta) dias.',
        ],
      },
      {
        sectionTitle: 'REMUNERAÇÃO, REAJUSTE E NÍVEL DE SERVIÇO (SLA)',
        paragraphs: [
          'CLÁUSULA 3ª (DO PREÇO E PAGAMENTO): Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor mensal fixo de R$ 14.500,00 (quatorze mil e quinhentos reais), perfazendo o valor global estimado de R$ 348.000,00 (trezentos e quarenta e oito mil reais) durante os 24 meses iniciais.',
          'O pagamento será efetuado todo dia 10 de cada mês subsequente à prestação dos serviços, mediante emissão de Nota Fiscal eletrônica com antecedência mínima de 5 dias úteis.',
          'CLÁUSULA 4ª (DO REAJUSTE): Os valores contratados serão reajustados anualmente na data de aniversário do contrato pela variação acumulada do índice IPCA/IBGE.',
          'CLÁUSULA 5ª (DO SLA): A CONTRATADA compromete-se a manter disponibilidade mínima de 99,5% para os conectores críticos de faturamento, com tempo máximo de primeira resposta de 2 horas para incidentes severos.',
        ],
      },
      {
        sectionTitle: 'CONFIDENCIALIDADE, RESCISÃO ANTECIPADA E FORO',
        paragraphs: [
          'CLÁUSULA 6ª (DA CONFIDENCIALIDADE E LGPD): As partes obrigam-se a manter sigilo absoluto sobre dados comerciais, bases de clientes e segredos industriais tratados no âmbito deste contrato pelo prazo de 5 (cinco) anos após o encerramento do vínculo, em conformidade com a Lei nº 13.709/2018 (LGPD).',
          'CLÁUSULA 7ª (DA RESCISÃO E MULTA): A rescisão imotivada antes do término dos primeiros 12 meses de vigência sujeitará a parte infratora ao pagamento de multa compensatória equivalente a 20% (vinte por cento) sobre o saldo remanescente do contrato até completar o primeiro ciclo anual.',
          'CLÁUSULA 8ª (DO FORO): Fica eleito o Foro Central da Comarca de Curitiba, Estado do Paraná, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
          'Curitiba/PR, 20 de novembro de 2026. Assinado eletronicamente pelas representantes legais das partes.',
        ],
      },
    ],
  },
];

function sanitizeWinAnsi(input: string): string {
  return input
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = sanitizeWinAnsi(text).split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

export function listSampleDocuments(): SampleDocumentInfo[] {
  return SAMPLE_BLUEPRINTS.map(
    ({ slug, filename, title, category, expectedUrgency, hasCnj, summary, pageCount }) => ({
      slug,
      filename,
      title,
      category,
      expectedUrgency,
      hasCnj,
      summary,
      pageCount,
    })
  );
}

export function getSampleInfo(slug: string): SampleDocumentInfo | null {
  const found = SAMPLE_BLUEPRINTS.find((item) => item.slug === slug);
  if (!found) return null;
  const { filename, title, category, expectedUrgency, hasCnj, summary, pageCount } = found;
  return { slug: found.slug, filename, title, category, expectedUrgency, hasCnj, summary, pageCount };
}

export async function generateSamplePdfBuffer(slug: string): Promise<{ filename: string; buffer: Buffer } | null> {
  const blueprint = SAMPLE_BLUEPRINTS.find((item) => item.slug === slug);
  if (!blueprint) {
    return null;
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(sanitizeWinAnsi(blueprint.title));
  pdfDoc.setAuthor('JurisTriage Demo Generator');
  pdfDoc.setSubject(sanitizeWinAnsi(blueprint.category));

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 56;
  const totalPages = blueprint.pages.length;

  blueprint.pages.forEach((pageData, index) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - 58;

    page.drawText(sanitizeWinAnsi(blueprint.headerTitle), {
      x: marginX,
      y: cursorY,
      size: 11.5,
      font: boldFont,
      color: rgb(0.12, 0.23, 0.37),
    });
    cursorY -= 16;

    page.drawText(sanitizeWinAnsi(blueprint.headerSubtitle), {
      x: marginX,
      y: cursorY,
      size: 9.5,
      font: regularFont,
      color: rgb(0.35, 0.4, 0.48),
    });
    cursorY -= 12;

    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: pageWidth - marginX, y: cursorY },
      thickness: 0.75,
      color: rgb(0.82, 0.85, 0.89),
    });
    cursorY -= 26;

    const sectionLines = wrapText(pageData.sectionTitle, 74);
    for (const line of sectionLines) {
      page.drawText(line, {
        x: marginX,
        y: cursorY,
        size: 11,
        font: boldFont,
        color: rgb(0.06, 0.09, 0.16),
      });
      cursorY -= 16;
    }
    cursorY -= 8;

    for (const paragraph of pageData.paragraphs) {
      const lines = wrapText(paragraph, 84);
      for (const line of lines) {
        if (cursorY < 72) {
          break;
        }
        page.drawText(line, {
          x: marginX,
          y: cursorY,
          size: 10.2,
          font: regularFont,
          color: rgb(0.12, 0.16, 0.23),
        });
        cursorY -= 15;
      }
      cursorY -= 10;
    }

    page.drawLine({
      start: { x: marginX, y: 52 },
      end: { x: pageWidth - marginX, y: 52 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.91),
    });

    page.drawText(
      sanitizeWinAnsi(`JurisTriage — Massa de Teste Fictícia  |  Página ${index + 1} de ${totalPages}`),
      {
        x: marginX,
        y: 36,
        size: 8.5,
        font: regularFont,
        color: rgb(0.45, 0.5, 0.57),
      }
    );
  });

  const pdfBytes = await pdfDoc.save();
  return {
    filename: blueprint.filename,
    buffer: Buffer.from(pdfBytes),
  };
}
