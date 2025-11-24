import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import XLSX from 'xlsx';

function ensureReportsDir() {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

export async function dispatchReport({ workbook, fileName, metrics, type = 'monthly', newClients = [] }) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    REPORT_TO,
    REPORT_FROM = SMTP_USER || 'no-reply@example.com'
  } = process.env;

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const canEmail = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && REPORT_TO;

  if (!canEmail) {
    // Fallback: salva arquivo local e loga aviso
    const dir = ensureReportsDir();
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`Relatório salvo localmente em ${filePath} (SMTP não configurado).`);
    return { delivered: false, filePath, metrics };
  }

  // Cria transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: parseInt(SMTP_PORT) === 465, // heuristic
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  let subject;
  let html;

  if (type === 'weekly') {
    subject = `Relatório Semanal de Clientes - ${fileName.replace('.xlsx','')}`;
    const newClientsHtml = newClients.length ? `
      <h3>Novos Clientes (${newClients.length})</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">ID</th>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">Nome</th>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">Status</th>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">Corretor</th>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">Responsável</th>
            <th style="border:1px solid #ccc;padding:4px;text-align:left;">Criado Em</th>
          </tr>
        </thead>
        <tbody>
          ${newClients.map(c => `<tr>
            <td style=\"border:1px solid #eee;padding:4px;\">${c.id}</td>
            <td style=\"border:1px solid #eee;padding:4px;\">${c.nome || ''}</td>
            <td style=\"border:1px solid #eee;padding:4px;\">${c.status || ''}</td>
            <td style=\"border:1px solid #eee;padding:4px;\">${c.corretor || ''}</td>
            <td style=\"border:1px solid #eee;padding:4px;\">${c.responsavel || ''}</td>
            <td style=\"border:1px solid #eee;padding:4px;\">${c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    ` : '<p>Nenhum novo cliente na semana.</p>';

    html = `
      <h2>Relatório Semanal de Clientes</h2>
      <p>Resumo do período:</p>
      <ul>
        ${Object.entries(metrics).map(([k,v]) => `<li><strong>${k}</strong>: ${v}</li>`).join('')}
      </ul>
      ${newClientsHtml}
      <p>Anexo: backup completo da base de clientes (xlsx).</p>
      <p>Este e-mail foi gerado automaticamente.</p>
    `;
  } else {
    subject = `Relatório Mensal de Clientes - ${fileName.replace('relatorio_clientes_', '').replace('.xlsx','')}`;
    html = `
      <h2>Relatório Mensal de Clientes</h2>
      <p>Segue em anexo o relatório mensal.</p>
      <h3>Resumo</h3>
      <ul>
        ${Object.entries(metrics).map(([k,v]) => `<li><strong>${k}</strong>: ${v}</li>`).join('')}
      </ul>
      <p>Este e-mail foi gerado automaticamente.</p>
    `;
  }

  try {
    await transporter.sendMail({
      from: REPORT_FROM,
      to: REPORT_TO,
      subject,
      html,
      attachments: [
        { filename: fileName, content: buffer }
      ]
    });
    console.log('Relatório enviado por e-mail com sucesso.');
    return { delivered: true, metrics, type };
  } catch (err) {
    console.error('Falha ao enviar e-mail, salvando localmente.', err);
    const dir = ensureReportsDir();
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { delivered: false, filePath, error: err.message, metrics, type };
  }
}
