import sgMail from '@sendgrid/mail';

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SendGrid API key not found. Email notifications will be disabled.');
}

interface OrderEmailData {
  orderId: number;
  customerEmail: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
  }>;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
  };
  paymentMethod: string;
}

export async function sendOrderConfirmationEmail(orderData: OrderEmailData): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('📧 Skipping email notification (SendGrid not configured)');
    return false;
  }

  try {
    const itemsList = orderData.items.map(item => 
      `• ${item.name}${item.size ? ` (${item.size})` : ''} - Quantità: ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff;">
        <div style="background: #F7931A; padding: 20px; text-align: center;">
          <h1 style="margin: 0; color: #000;">BitGadget</h1>
          <p style="margin: 5px 0 0 0; color: #000;">Conferma Ordine</p>
        </div>
        
        <div style="padding: 30px;">
          <h2 style="color: #F7931A;">Ordine Confermato! 🎉</h2>
          
          <p>Ciao ${orderData.customerName},</p>
          <p>Grazie per il tuo ordine! Abbiamo ricevuto la tua richiesta e stiamo preparando i tuoi prodotti Bitcoin.</p>
          
          <div style="background: #111; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #F7931A; margin-top: 0;">Dettagli Ordine #${orderData.orderId.toString().padStart(6, '0')}</h3>
            
            <div style="margin: 15px 0;">
              <strong>Prodotti ordinati:</strong><br>
              <div style="margin: 10px 0; padding: 10px; background: #222; border-radius: 4px;">
                ${orderData.items.map(item => `
                  <div style="margin: 5px 0;">
                    ${item.name}${item.size ? ` (${item.size})` : ''}<br>
                    <span style="color: #999;">Quantità: ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div style="margin: 15px 0;">
              <strong>Metodo di pagamento:</strong> ${orderData.paymentMethod === 'bitcoin' ? 'Bitcoin' : 'Carta di credito'}
            </div>
            
            <div style="margin: 15px 0;">
              <strong>Indirizzo di spedizione:</strong><br>
              ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
              ${orderData.shippingAddress.address}<br>
              ${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}<br>
              ${orderData.shippingAddress.phone}
            </div>
            
            <div style="border-top: 1px solid #333; padding-top: 15px; margin-top: 15px;">
              <strong style="color: #F7931A; font-size: 18px;">Totale: €${orderData.total.toFixed(2)}</strong>
            </div>
          </div>
          
          ${orderData.paymentMethod === 'bitcoin' ? `
            <div style="background: #F7931A; color: #000; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0;">🪙 Pagamento Bitcoin</h4>
              <p style="margin: 0;">Ti invieremo separatamente le istruzioni per completare il pagamento Bitcoin. Una volta ricevuto il pagamento, elaboreremo immediatamente il tuo ordine.</p>
            </div>
          ` : ''}
          
          <div style="margin: 30px 0;">
            <h3 style="color: #F7931A;">Prossimi Passi</h3>
            <ul style="padding-left: 20px;">
              <li>Ti invieremo una conferma di spedizione con il codice di tracking</li>
              <li>Elaboreremo il tuo ordine entro 1-2 giorni lavorativi</li>
              <li>Spedizione gratuita per ordini superiori a €80</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p>Hai domande? Contattaci:</p>
            <p>
              📧 <a href="mailto:bitgadgetshop@gmail.com" style="color: #F7931A;">bitgadgetshop@gmail.com</a><br>
              📱 <a href="https://wa.me/393515123688" style="color: #F7931A;">WhatsApp: +39 351 512 3688</a>
            </p>
          </div>
        </div>
        
        <div style="background: #111; padding: 20px; text-align: center; border-top: 1px solid #333;">
          <p style="margin: 0; color: #666; font-size: 12px;">
            BITGADGET – Via M. Gortani 15, 33033 Codroipo (UD), Italy<br>
            Orari: Lunedì–Venerdì, 9:00 – 18:00 (CET)
          </p>
        </div>
      </div>
    `;

    const msg = {
      to: orderData.customerEmail,
      from: {
        email: 'bitgadgetshop@gmail.com',
        name: 'BitGadget'
      },
      subject: `✅ Conferma Ordine #${orderData.orderId.toString().padStart(6, '0')} - BitGadget`,
      html: emailHtml,
      text: `
Ciao ${orderData.customerName},

Grazie per il tuo ordine BitGadget!

Ordine #${orderData.orderId.toString().padStart(6, '0')}
Prodotti:
${itemsList}

Totale: €${orderData.total.toFixed(2)}
Metodo di pagamento: ${orderData.paymentMethod === 'bitcoin' ? 'Bitcoin' : 'Carta di credito'}

Indirizzo di spedizione:
${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}
${orderData.shippingAddress.address}
${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}

Ti invieremo una conferma di spedizione appena il tuo ordine sarà in viaggio.

Per domande: bitgadgetshop@gmail.com
WhatsApp: +39 351 512 3688

Grazie per aver scelto BitGadget!
      `
    };

    await sgMail.send(msg);
    console.log(`📧 Order confirmation email sent to ${orderData.customerEmail}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send order confirmation email:', error);
    return false;
  }
}

export async function sendAdminOrderNotification(orderData: OrderEmailData): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    return false;
  }

  try {
    const itemsList = orderData.items.map(item => 
      `• ${item.name}${item.size ? ` (${item.size})` : ''} - Qty: ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const msg = {
      to: 'bitgadgetshop@gmail.com',
      from: {
        email: 'bitgadgetshop@gmail.com',
        name: 'BitGadget System'
      },
      subject: `🔔 Nuovo Ordine #${orderData.orderId} - €${orderData.total.toFixed(2)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #F7931A;">Nuovo Ordine Ricevuto!</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Ordine #${orderData.orderId.toString().padStart(6, '0')}</h3>
            <p><strong>Cliente:</strong> ${orderData.customerName}</p>
            <p><strong>Email:</strong> ${orderData.customerEmail}</p>
            <p><strong>Pagamento:</strong> ${orderData.paymentMethod === 'bitcoin' ? 'Bitcoin' : 'Carta di credito'}</p>
            <p><strong>Totale:</strong> €${orderData.total.toFixed(2)}</p>
            
            <h4>Prodotti:</h4>
            <div style="background: white; padding: 15px; border-radius: 4px;">
              ${orderData.items.map(item => `
                <div style="margin: 5px 0; padding: 5px 0; border-bottom: 1px solid #eee;">
                  ${item.name}${item.size ? ` (${item.size})` : ''}<br>
                  <small>Quantità: ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}</small>
                </div>
              `).join('')}
            </div>
            
            <h4>Indirizzo di spedizione:</h4>
            <div style="background: white; padding: 15px; border-radius: 4px;">
              ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
              ${orderData.shippingAddress.address}<br>
              ${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}<br>
              Tel: ${orderData.shippingAddress.phone}
            </div>
          </div>
          
          <p>Accedi al dashboard admin per gestire questo ordine.</p>
        </div>
      `,
      text: `
Nuovo ordine ricevuto!

Ordine #${orderData.orderId.toString().padStart(6, '0')}
Cliente: ${orderData.customerName} (${orderData.customerEmail})
Pagamento: ${orderData.paymentMethod === 'bitcoin' ? 'Bitcoin' : 'Carta di credito'}
Totale: €${orderData.total.toFixed(2)}

Prodotti:
${itemsList}

Indirizzo:
${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}
${orderData.shippingAddress.address}
${orderData.shippingAddress.postalCode} ${orderData.shippingAddress.city}
Tel: ${orderData.shippingAddress.phone}
      `
    };

    await sgMail.send(msg);
    console.log(`📧 Admin notification sent for order #${orderData.orderId}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
    return false;
  }
}

export async function sendBitcoinPaymentInstructions(orderData: OrderEmailData, bitcoinAddress: string, btcAmount: number): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    return false;
  }

  try {
    const msg = {
      to: orderData.customerEmail,
      from: {
        email: 'bitgadgetshop@gmail.com',
        name: 'BitGadget'
      },
      subject: `🪙 Istruzioni Pagamento Bitcoin - Ordine #${orderData.orderId.toString().padStart(6, '0')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff;">
          <div style="background: #F7931A; padding: 20px; text-align: center;">
            <h1 style="margin: 0; color: #000;">BitGadget</h1>
            <p style="margin: 5px 0 0 0; color: #000;">Istruzioni Pagamento Bitcoin</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #F7931A;">Completa il tuo pagamento Bitcoin 🪙</h2>
            
            <p>Ciao ${orderData.customerName},</p>
            <p>Per completare il tuo ordine, invia esattamente <strong style="color: #F7931A;">${btcAmount} BTC</strong> al seguente indirizzo:</p>
            
            <div style="background: #111; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="color: #F7931A; margin-top: 0;">Indirizzo Bitcoin</h3>
              <div style="background: #000; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 14px; word-break: break-all; border: 2px solid #F7931A;">
                ${bitcoinAddress}
              </div>
              <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Copia l'indirizzo esatto - Bitcoin è case sensitive!</p>
            </div>
            
            <div style="background: #222; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #F7931A; margin-top: 0;">Dettagli Pagamento</h4>
              <p><strong>Importo:</strong> ${btcAmount} BTC</p>
              <p><strong>Equivalente:</strong> ~€${orderData.total.toFixed(2)}</p>
              <p><strong>Ordine:</strong> #${orderData.orderId.toString().padStart(6, '0')}</p>
            </div>
            
            <div style="background: #F7931A; color: #000; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0;">⚠️ Importante</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Invia esattamente ${btcAmount} BTC</li>
                <li>Il pagamento deve essere completato entro 24 ore</li>
                <li>Una volta confermato il pagamento, elaboreremo immediatamente il tuo ordine</li>
                <li>Riceverai una conferma via email quando il pagamento sarà ricevuto</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p>Hai domande sul pagamento Bitcoin?</p>
              <p>
                📧 <a href="mailto:bitgadgetshop@gmail.com" style="color: #F7931A;">bitgadgetshop@gmail.com</a><br>
                📱 <a href="https://wa.me/393515123688" style="color: #F7931A;">WhatsApp: +39 351 512 3688</a>
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Istruzioni Pagamento Bitcoin - Ordine #${orderData.orderId.toString().padStart(6, '0')}

Ciao ${orderData.customerName},

Per completare il tuo ordine, invia esattamente ${btcAmount} BTC al seguente indirizzo:

${bitcoinAddress}

Dettagli:
- Importo: ${btcAmount} BTC (~€${orderData.total.toFixed(2)})
- Ordine: #${orderData.orderId.toString().padStart(6, '0')}

IMPORTANTE:
- Invia esattamente ${btcAmount} BTC
- Completa il pagamento entro 24 ore
- Riceverai conferma via email quando il pagamento sarà ricevuto

Per domande: bitgadgetshop@gmail.com o WhatsApp +39 351 512 3688
      `
    };

    await sgMail.send(msg);
    console.log(`📧 Bitcoin payment instructions sent to ${orderData.customerEmail}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send Bitcoin payment instructions:', error);
    return false;
  }
}