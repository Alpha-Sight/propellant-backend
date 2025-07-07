export const classicCVTemplate = ({
  fullName,
  professionalTitle,
  professionalSummary,
  email,
  phone,
  address,
  linkedin,
  github,
  portfolio,
  skills = [],
  education = [],
  experience = [],
  projects = [],
  certifications = [],
  languages = [],
  hobbies = [],
  achievements = [],
}: any): string => `
    <html>
      <head>
        <style>
          body {
            font-family: Georgia, 'Times New Roman', Times, serif;
            font-size: 12px;
            line-height: 1.6;
            color: #000;
            padding: 40px;
            background-color: #fff;
          }
          h1 {
            font-size: 28px;
            margin-bottom: 0;
          }
          h2 {
            font-size: 16px;
            margin-top: 40px;
            margin-bottom: 10px;
            border-bottom: 1px solid #999;
            padding-bottom: 3px;
          }
          p, li {
            margin: 4px 0;
          }
          .section {
            margin-top: 20px;
          }
          ul {
            padding-left: 20px;
          }
        </style>
      </head>
      <body>
        <h1>${fullName}</h1>
        <p><strong>${professionalTitle}</strong></p>
        <p>${professionalSummary || ''}</p>
  
        <h2>Contact Information</h2>
        <p>Email: ${email || ''}</p>
        <p>Phone: ${phone || ''}</p>
        <p>Address: ${address || ''}</p>
        <p>LinkedIn: ${linkedin || ''}</p>
        <p>GitHub: ${github || ''}</p>
        <p>Portfolio: ${portfolio || ''}</p>
  
        <h2>Skills</h2>
        <ul>
          ${skills.map((s: any) => `<li>${s.name}${s.level ? ` (${s.level})` : ''}</li>`).join('')}
        </ul>
  
        <h2>Education</h2>
        <ul>
          ${education
            .map(
              (e: any) => `
            <li>
              <strong>${e.degree} in ${e.fieldOfStudy}</strong>, ${e.institution} (${e.startDate} - ${e.endDate || 'Present'})
              <br/>${e.grade || ''} - ${e.description || ''}
            </li>`,
            )
            .join('')}
        </ul>
  
        <h2>Experience</h2>
        <ul>
          ${experience
            .map(
              (x: any) => `
            <li>
              <strong>${x.position}</strong>, ${x.company} (${x.startDate} - ${x.endDate || 'Present'})
              <br/>${x.description || ''}, ${x.location || ''}
            </li>`,
            )
            .join('')}
        </ul>
  
        <h2>Projects</h2>
        <ul>
          ${projects
            .map(
              (p: any) => `
            <li>
              <strong>${p.name}</strong><br/>
              ${p.description || ''}<br/>
              Technologies: ${p.technologies?.join(', ') || ''}<br/>
              <a href="${p.project || '#'}">${p.project || ''}</a> |
              <a href="${p.github || '#'}">${p.github || ''}</a>
            </li>`,
            )
            .join('')}
        </ul>
  
        <h2>Certifications</h2>
        <ul>
          ${certifications
            .map(
              (c: any) => `
            <li>
              ${c.name} - ${c.issuer} (${c.dateIssued})
              ${c.credentialId ? `<br/>ID: ${c.credentialId}` : ''}
              ${c.credentialUrl ? `<br/><a href="${c.credentialUrl}">${c.credentialUrl}</a>` : ''}
            </li>`,
            )
            .join('')}
        </ul>
  
        <h2>Languages</h2>
        <p>${languages.join(', ')}</p>
  
        <h2>Hobbies</h2>
        <p>${hobbies.join(', ')}</p>
  
        <h2>Achievements</h2>
        <ul>
          ${achievements.map((a: string) => `<li>${a}</li>`).join('')}
        </ul>
      </body>
    </html>
  `;
