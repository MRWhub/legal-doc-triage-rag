"""Gera 3 PDFs jurídicos fictícios realistas para demonstração ao vivo do JurisTriage."""

from pathlib import Path
from typing import Dict, List

from fpdf import FPDF

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "samples_output"


DOCUMENTS: List[Dict[str, object]] = [
    {
        "filename": "intimacao-prazo-critico.pdf",
        "header": "TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO",
        "subheader": "14ª Vara Cível do Foro Central da Comarca de São Paulo - Processo Digital",
        "pages": [
            {
                "title": "MANDADO DE INTIMAÇÃO EM CUMPRIMENTO DE SENTENÇA (URGENTE)",
                "paragraphs": [
                    "Processo nº (CNJ): 0014829-42.2026.8.26.0100",
                    "Classe: Cumprimento de Sentença - Obrigações Civis e Comerciais",
                    "Exequente: Banco Atlântico S.A. (CNPJ 12.345.678/0001-90)",
                    "Executada: Construtora Horizonte Ltda. (CNPJ 98.765.432/0001-10)",
                    "Valor Atualizado da Execução: R$ 184.750,00 (cento e oitenta e quatro mil, setecentos e cinquenta reais).",
                    "Fica a parte executada formalmente INTIMADA para que, no prazo peremptório e improrrogável de 5 (cinco) dias úteis contados da disponibilização no DJe, efetue o pagamento voluntário do débito exequendo ou apresente comprovante integral de quitação.",
                ],
            },
            {
                "title": "COMINAÇÕES LEGAIS, MULTA DIÁRIA E CONSTRIÇÃO PATRIMONIAL",
                "paragraphs": [
                    "Decorrido o prazo de 5 (cinco) dias úteis sem quitação integral, incidirão automaticamente:",
                    "1. Multa processual de 10% e honorários advocatícios de 10% sobre o saldo devedor (art. 523, parágrafo 1º, do CPC).",
                    "2. Multa diária (astreintes) de R$ 2.500,00 (dois mil e quinhentos reais) por dia de descumprimento da obrigação acessória de exibição de livros fiscais, limitada inicialmente a 30 dias.",
                    "3. Ordem imediata de bloqueio eletrônico via SISBAJUD e restrição via RENAJUD até o limite de R$ 184.750,00.",
                    "São Paulo, 24 de novembro de 2026. Dra. Helena Vasconcelos - Juíza de Direito Titular.",
                ],
            },
        ],
    },
    {
        "filename": "peticao-inicial-trabalhista.pdf",
        "header": "JUSTIÇA DO TRABALHO - TRIBUNAL REGIONAL DO TRABALHO DA 2ª REGIÃO",
        "subheader": "38ª Vara do Trabalho de São Paulo - Rito Ordinário",
        "pages": [
            {
                "title": "PETIÇÃO INICIAL - RECLAMAÇÃO TRABALHISTA",
                "paragraphs": [
                    "Processo nº (CNJ): 0000912-88.2026.5.02.0038",
                    "Reclamante: Carlos Eduardo Mendes, técnico de manutenção industrial, CPF 321.654.987-00.",
                    "Reclamada: Logística Express Brasil Ltda., CNPJ 45.112.890/0001-44, sede em Barueri/SP.",
                    "I. DO CONTRATO DE TRABALHO: Admitido em 10/03/2023 como Técnico de Manutenção de Frota, último salário base de R$ 4.850,00, dispensado sem justa causa em 15/10/2026.",
                    "Cumpriu jornada habitual das 07h00 às 18h30 de segunda a sexta-feira, com apenas 30 minutos de intervalo intrajornada, sem a correta remuneração das horas extras.",
                ],
            },
            {
                "title": "II. DOS PEDIDOS E FUNDAMENTAÇÃO JURÍDICA",
                "paragraphs": [
                    "1. Horas Extras e Intervalo Intrajornada: Pagamento de 2 horas extras diárias com adicional de 50% (dias úteis) e 100% (domingos) e reflexos, totalizando R$ 39.200,00.",
                    "2. Adicional de Periculosidade (30%): Atuação diária junto a tanque aéreo de óleo diesel de 15.000 litros sem pagamento do adicional do art. 193 da CLT. Valor estimado com reflexos: R$ 21.420,00.",
                    "3. Multa do art. 477 da CLT e Diferenças Rescisórias: Atraso de 6 dias no pagamento das verbas rescisórias, totalizando R$ 7.800,00 (R$ 4.850,00 de multa + R$ 2.950,00 de diferenças).",
                ],
            },
            {
                "title": "III. DO VALOR DA CAUSA E REQUERIMENTOS FINAIS",
                "paragraphs": [
                    "Requer a notificação da Reclamada para apresentar defesa até a audiência inaugural, estimada para ocorrer no prazo de 30 (trinta) dias a contar da citação.",
                    "Requer designação de perícia técnica de engenharia de segurança do trabalho para apuração de periculosidade.",
                    "Dá-se à presente causa o valor total líquido estimado de R$ 68.420,00 (sessenta e oito mil, quatrocentos e vinte reais).",
                    "São Paulo, 19 de novembro de 2026. Dr. Rafael Nogueira - OAB/SP 312.450.",
                ],
            },
        ],
    },
    {
        "filename": "contrato-comercial-servicos.pdf",
        "header": "INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA",
        "subheader": "Documento Extrajudicial - Departamento Jurídico Corporativo",
        "pages": [
            {
                "title": "QUALIFICAÇÃO DAS PARTES, OBJETO E VIGÊNCIA",
                "paragraphs": [
                    "CONTRATANTE: Grupo Vértice Alimentos S.A., CNPJ 22.874.110/0001-65, Av. Batel, 1500, Curitiba/PR.",
                    "CONTRATADA: DataCore Engenharia de Software Ltda., CNPJ 33.410.992/0001-08, Rua XV de Novembro, 890, Curitiba/PR.",
                    "CLÁUSULA 1ª (OBJETO): Prestação contínua de sustentação em nuvem e evolução de integrações ERP pela CONTRATADA.",
                    "CLÁUSULA 2ª (VIGÊNCIA): Prazo determinado de 24 (vinte e quatro) meses, de 01/12/2026 a 30/11/2028, com renovação automática por 12 meses salvo aviso prévio formal de 60 (sessenta) dias.",
                ],
            },
            {
                "title": "REMUNERAÇÃO, REAJUSTE E NÍVEL DE SERVIÇO (SLA)",
                "paragraphs": [
                    "CLÁUSULA 3ª (PREÇO): Valor mensal fixo de R$ 14.500,00, perfazendo o valor global estimado de R$ 348.000,00 (trezentos e quarenta e oito mil reais) nos 24 meses iniciais.",
                    "CLÁUSULA 4ª (REAJUSTE): Reajuste anual pela variação acumulada do IPCA/IBGE.",
                    "CLÁUSULA 5ª (SLA): Disponibilidade mínima de 99,5% nos conectores críticos de faturamento, com resposta inicial em até 2 horas.",
                ],
            },
            {
                "title": "CONFIDENCIALIDADE, RESCISÃO ANTECIPADA E FORO",
                "paragraphs": [
                    "CLÁUSULA 6ª (SIGILO E LGPD): Obrigação de sigilo pelo prazo de 5 anos após o encerramento, em conformidade com a Lei nº 13.709/2018.",
                    "CLÁUSULA 7ª (RESCISÃO E MULTA): A rescisão imotivada antes dos primeiros 12 meses sujeita a parte infratora a multa compensatória de 20% sobre o saldo remanescente do primeiro ciclo anual.",
                    "CLÁUSULA 8ª (FORO): Fica eleito o Foro Central da Comarca de Curitiba/PR para dirimir controvérsias.",
                    "Curitiba/PR, 20 de novembro de 2026. Assinado eletronicamente pelas partes.",
                ],
            },
        ],
    },
]


class LegalSamplePDF(FPDF):
    def __init__(self, header_title: str, subheader_title: str) -> None:
        super().__init__()
        self.header_title = header_title
        self.subheader_title = subheader_title
        self.set_auto_page_break(auto=True, margin=22)

    def header(self) -> None:
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 58, 95)
        self.cell(0, 7, self.header_title, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(90, 102, 120)
        self.cell(0, 5, self.subheader_title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_draw_color(210, 218, 228)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-16)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(115, 126, 142)
        self.cell(
            0,
            8,
            f"JurisTriage - Massa de Teste Fictícia | Página {self.page_no()}",
            align="L",
        )


def generate_all_samples() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in DOCUMENTS:
        pdf = LegalSamplePDF(str(spec["header"]), str(spec["subheader"]))
        pages = spec["pages"]
        assert isinstance(pages, list)
        for page_data in pages:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(15, 23, 42)
            pdf.multi_cell(0, 6.5, str(page_data["title"]))
            pdf.ln(3)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(30, 41, 59)
            for paragraph in page_data["paragraphs"]:
                pdf.multi_cell(0, 6, str(paragraph))
                pdf.ln(2.5)

        output_path = OUTPUT_DIR / str(spec["filename"])
        pdf.output(str(output_path))
        print(f"[OK] Gerado: {output_path}")


if __name__ == "__main__":
    generate_all_samples()
