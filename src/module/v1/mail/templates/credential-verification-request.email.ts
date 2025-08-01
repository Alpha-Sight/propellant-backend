export function CredentialVerificationRequestTemplate(data: {
  verifyingOrganization: string;
  verifyingEmail: string;
  issuingOrganization?: string;
  credentialTitle: string;
  userName: string;
  message?: string;
  issueDate?: string;
  expiryDate?: string;
  url?: string;
}) {
  return `
    <div>
      <h2>Credential Verification Request</h2>
      <p>Dear ${data.verifyingOrganization},</p>
      <p>The following credential has been submitted for verification:</p>
      <ul>
        <li><strong>Credential:</strong> ${data.credentialTitle}</li>
        <li><strong>Issued By:</strong> ${data.issuingOrganization || 'N/A'}</li>
        <li><strong>Submitted By:</strong> ${data.userName}</li>
        <li><strong>Issue Date:</strong> ${data.issueDate || 'N/A'}</li>
        <li><strong>Expiry Date:</strong> ${data.expiryDate || 'N/A'}</li>
        <li><strong>Credential Link:</strong> ${data.url || 'N/A'}</li>
      </ul>
      ${data.message ? `<p><strong>Message from submitter:</strong> ${data.message}</p>` : ''}
      <p>Please review and verify this credential at your earliest convenience.</p>
      <p>Thank you.</p>
    </div>
  `;
}
