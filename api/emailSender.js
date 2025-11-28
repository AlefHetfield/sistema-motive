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
    subject = `📊 Relatório Semanal de Clientes - ${fileName.replace('.xlsx','')}`;
    
    const newClientsHtml = newClients.length ? `
      <div style="margin: 30px 0;">
        <h3 style="color: #1a1a1a; font-size: 20px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #3b82f6;">
          👥 Novos Clientes (${newClients.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">ID</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Nome</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Corretor</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Responsável</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Criado Em</th>
            </tr>
          </thead>
          <tbody>
            ${newClients.map((c, idx) => `<tr style="border-bottom: 1px solid #f3f4f6; ${idx % 2 === 0 ? 'background: #fafafa;' : 'background: white;'} transition: background 0.2s;">
              <td style="padding: 14px 12px; color: #6b7280; font-size: 14px; font-weight: 500;">#${c.id}</td>
              <td style="padding: 14px 12px; color: #1f2937; font-size: 14px; font-weight: 600;">${c.nome || '-'}</td>
              <td style="padding: 14px 12px; color: #1f2937; font-size: 14px;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; 
                  ${c.status?.includes('Assinado') ? 'background: #d1fae5; color: #065f46;' : 
                    c.status?.includes('Aprovado') ? 'background: #dbeafe; color: #1e40af;' :
                    c.status?.includes('Finalização') ? 'background: #fef3c7; color: #92400e;' :
                    'background: #f3f4f6; color: #4b5563;'}">
                  ${c.status || 'Pendente'}
                </span>
              </td>
              <td style="padding: 14px 12px; color: #6b7280; font-size: 14px;">${c.corretor || '-'}</td>
              <td style="padding: 14px 12px; color: #6b7280; font-size: 14px;">${c.responsavel || '-'}</td>
              <td style="padding: 14px 12px; color: #6b7280; font-size: 13px;">${c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div style="margin: 30px 0; padding: 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 500;">
          ℹ️ Nenhum novo cliente foi cadastrado na semana.
        </p>
      </div>
    `;

    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f9fafb;">
        <div style="max-width: 800px; margin: 0 auto; background: white;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
              📊 Relatório Semanal
            </h1>
            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 400;">
              Resumo de Clientes
            </p>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <!-- Metrics Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Período</div>
                <div style="color: white; font-size: 16px; font-weight: 700;">${metrics.periodoSemanal || '-'}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Novos na Semana</div>
                <div style="color: white; font-size: 32px; font-weight: 700;">${metrics.novosNaSemana || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Assinados na Semana</div>
                <div style="color: white; font-size: 32px; font-weight: 700;">${metrics.assinadosNaSemana || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Taxa de Conversão</div>
                <div style="color: white; font-size: 32px; font-weight: 700;">${((metrics.taxaConversaoAtual || 0) * 100).toFixed(1)}%</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Média de Dias</div>
                <div style="color: white; font-size: 32px; font-weight: 700;">${Math.abs(metrics.mediaDiasAteAssinaturaSemana || 0).toFixed(0)}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(236, 72, 153, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Total na Base</div>
                <div style="color: white; font-size: 32px; font-weight: 700;">${metrics.totalBase || 0}</div>
              </div>
            </div>

            ${newClientsHtml}

            <!-- Info Box -->
            <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%); border-radius: 12px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                📎 Arquivo Anexo
              </p>
              <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                O arquivo Excel anexo contém o backup completo da base de clientes, resumo semanal detalhado e a lista completa de novos clientes do período.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              Este e-mail foi gerado automaticamente pelo Sistema Motive
            </p>
            <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
              ${new Date().toLocaleString('pt-BR', {dateStyle: 'full', timeStyle: 'short'})}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    subject = `📊 Relatório Mensal de Clientes - ${fileName.replace('relatorio_clientes_', '').replace('.xlsx','')}`;
    
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f9fafb;">
        <div style="max-width: 800px; margin: 0 auto; background: white;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
              📊 Relatório Mensal
            </h1>
            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 400;">
              Análise Completa de Clientes
            </p>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <!-- Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 40px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Período</div>
                <div style="color: white; font-size: 20px; font-weight: 700;">${metrics.periodo || '-'}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total de Clientes</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${metrics.totalClientes || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Novos no Período</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${metrics.novosNoPeriodo || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Assinados</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${metrics.assinadosNoPeriodo || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Clientes Ativos</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${metrics.ativos || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(6, 182, 212, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total Assinados</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${metrics.assinados || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(100, 116, 139, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Arquivados</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${metrics.arquivados || 0}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(236, 72, 153, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Taxa de Conversão</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${((metrics.taxaConversao || 0) * 100).toFixed(1)}%</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(244, 63, 94, 0.2);">
                <div style="color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Dias até Assinatura</div>
                <div style="color: white; font-size: 28px; font-weight: 700;">${(metrics.mediaDiasAteAssinatura || 0).toFixed(0)}</div>
              </div>
            </div>

            <!-- Info Box -->
            <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%); border-radius: 12px; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                📎 Arquivo Anexo
              </p>
              <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                O relatório completo está disponível no arquivo Excel anexo, contendo todos os dados dos clientes e análises detalhadas do período.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              Este e-mail foi gerado automaticamente pelo Sistema Motive
            </p>
            <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
              ${new Date().toLocaleString('pt-BR', {dateStyle: 'full', timeStyle: 'short'})}
            </p>
          </div>
        </div>
      </body>
      </html>
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
