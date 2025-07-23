// import PDFDocument = require('pdfkit');
// import { createWriteStream } from 'fs';

// export class PDFHelper {
//   static generatePDFWithTemplate(user: any, filePath: string): Promise<void> {
//     return new Promise<void>((resolve, reject) => {
//       const doc = new PDFDocument({ margin: 50 });
//       const stream = createWriteStream(filePath);
//       doc.pipe(stream);

//       doc
//         .fontSize(24)
//         .text(`${user.firstName} ${user.lastName}`, { align: 'center' })
//         .moveDown();
//       doc.fontSize(12).text(`Email: ${user.email}`, { align: 'center' });
//       if (user.phone) doc.text(`Phone: ${user.phone}`, { align: 'center' });
//       const address = [user.address, user.city, user.country]
//         .filter(Boolean)
//         .join(', ');
//       if (address) doc.text(`Address: ${address}`, { align: 'center' });
//       doc.moveDown();

//       if (user.bio) {
//         doc.fontSize(16).text('Professional Summary', { underline: true });
//         doc.fontSize(12).text(user.bio).moveDown();
//       }

//       doc.fontSize(16).text('Education', { underline: true }).moveDown(0.5);
//       user.education.forEach((edu) => {
//         doc.fontSize(14).text(`${edu.degree} in ${edu.fieldOfStudy}`);
//         doc.fontSize(12).text(`${edu.institution}`);
//         doc.text(`${edu.startDate} - ${edu.endDate || 'Present'}`);
//         if (edu.grade) doc.text(`Grade: ${edu.grade}`);
//         if (edu.description) doc.text(edu.description);
//         doc.moveDown();
//       });

//       if (user.workExperience?.length) {
//         doc
//           .fontSize(16)
//           .text('Work Experience', { underline: true })
//           .moveDown(0.5);
//         user.workExperience.forEach((job) => {
//           doc.fontSize(14).text(job.title || job.position);
//           doc.fontSize(12).text(job.company);
//           doc.text(`${job.startDate} - ${job.endDate || 'Present'}`);
//           if (job.description) doc.text(job.description);
//           doc.moveDown();
//         });
//       }

//       if (user.skills?.length) {
//         doc.fontSize(16).text('Skills', { underline: true }).moveDown(0.5);
//         doc.fontSize(12).text(user.skills.join(', ')).moveDown();
//       }

//       doc.end();
//       stream.on('finish', resolve);
//       stream.on('error', reject);
//     });
//   }
// }

// export const PDFUtil = new PDFHelper();

// utils/pdf.util.ts
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

export class PDFHelper {
  static async generatePDFfromHTML(
    html: string,
    fileName: string,
  ): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }

  static async generatePDFBufferFromHTML(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfUint8 = await page.pdf({ format: 'A4', printBackground: true });
    const pdfBuffer = Buffer.from(pdfUint8);

    await browser.close();
    return pdfBuffer;
  }
}
