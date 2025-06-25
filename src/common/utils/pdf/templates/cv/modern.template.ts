export const modernCVTemplate = ({
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
            font-family: 'Helvetica Neue', sans-serif;
            padding: 40px;
            background-color: #f9f9f9;
            color: #333;
          }
          h1 {
            font-size: 28px;
            margin: 0;
          }
          h2 {
            font-size: 18px;
            margin-top: 40px;
            color: #0a66c2;
            border-bottom: 2px solid #eee;
            padding-bottom: 4px;
          }
          .section {
            margin-bottom: 20px;
          }
          ul {
            padding-left: 20px;
          }
          .meta {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
          }
          .contact p {
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        <h1>${fullName || ''}</h1>
        <p class="meta"><strong>${professionalTitle || ''}</strong></p>
        <p>${professionalSummary || ''}</p>
  
        <div class="section contact">
          <h2>Contact</h2>
          <p>Email: ${email || 'N/A'}</p>
          <p>Phone: ${phone || 'N/A'}</p>
          <p>Address: ${address || 'N/A'}</p>
          <p>LinkedIn: ${linkedin || 'N/A'}</p>
          <p>GitHub: ${github || 'N/A'}</p>
          <p>Portfolio: ${portfolio || 'N/A'}</p>
        </div>
  
        ${
          skills.length
            ? `
          <div class="section">
            <h2>Skills</h2>
            <ul>
              ${skills.map((s: any) => `<li>${s.name}${s.level ? ` (${s.level})` : ''}</li>`).join('')}
            </ul>
          </div>`
            : ''
        }
  
        ${
          education.length
            ? `
          <div class="section">
            <h2>Education</h2>
            <ul>
              ${education
                .map(
                  (e: any) => `
                <li>
                  <strong>${e.degree}</strong> in ${e.fieldOfStudy}, ${e.institution} (${e.startDate} - ${e.endDate || 'Present'})<br/>
                  ${e.grade || ''} - ${e.description || ''}
                </li>`,
                )
                .join('')}
            </ul>
          </div>`
            : ''
        }
  
        ${
          experience.length
            ? `
          <div class="section">
            <h2>Experience</h2>
            <ul>
              ${experience
                .map(
                  (x: any) => `
                <li>
                  <strong>${x.position}</strong> at ${x.company} (${x.startDate} - ${x.endDate || 'Present'})<br/>
                  ${x.description || ''} (${x.location || ''})
                </li>`,
                )
                .join('')}
            </ul>
          </div>`
            : ''
        }
  
        ${
          projects.length
            ? `
          <div class="section">
            <h2>Projects</h2>
            <ul>
              ${projects
                .map(
                  (p: any) => `
                <li>
                  <strong>${p.name}</strong><br/>
                  ${p.description || ''}<br/>
                  ${p.technologies?.length ? `Tech: ${p.technologies.join(', ')}` : ''}<br/>
                  ${p.projectUrl ? `Live: <a href="${p.projectUrl}">${p.projectUrl}</a><br/>` : ''}
                  ${p.githubUrl ? `GitHub: <a href="${p.githubUrl}">${p.githubUrl}</a>` : ''}
                </li>`,
                )
                .join('')}
            </ul>
          </div>`
            : ''
        }
  
        ${
          certifications.length
            ? `
          <div class="section">
            <h2>Certifications</h2>
            <ul>
              ${certifications
                .map(
                  (c: any) => `
                <li>
                  ${c.name} - ${c.issuer} (${c.dateIssued})<br/>
                  ${c.credentialId ? `ID: ${c.credentialId}<br/>` : ''}
                  ${c.credentialUrl ? `Verify: <a href="${c.credentialUrl}">${c.credentialUrl}</a>` : ''}
                </li>`,
                )
                .join('')}
            </ul>
          </div>`
            : ''
        }
  
        ${
          languages.length
            ? `
          <div class="section">
            <h2>Languages</h2>
            <p>${languages.join(', ')}</p>
          </div>`
            : ''
        }
  
        ${
          hobbies.length
            ? `
          <div class="section">
            <h2>Hobbies</h2>
            <p>${hobbies.join(', ')}</p>
          </div>`
            : ''
        }
  
        ${
          achievements.length
            ? `
          <div class="section">
            <h2>Achievements</h2>
            <ul>
              ${achievements.map((a: string) => `<li>${a}</li>`).join('')}
            </ul>
          </div>`
            : ''
        }
      </body>
    </html>
  `;
