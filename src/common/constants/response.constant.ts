export const RESPONSE_CONSTANT = {
  AUTH: {
    REGISTER_SUCCESS:
      'Registration Successful, check email for account verification code ',
    LOGIN_SUCCESS: 'Login Successful',
    EMAIL_VERIFICATION_SUCCESS: 'Email verified successfully',
    PHONE_VERIFICATION_SUCCESS: 'Phone verified successfully',
    PASSWORD_RESET_EMAIL_SUCCESS: 'Password Reset Email Sent Successfully',
    PASSWORD_RESET_SUCCESS: 'Password Reset Successfully',
    WALLET_NONCE: 'Wallet Nonce Generated Successfully',
  },
  OTP: {
    OTP_VERIFIED_SUCCESS: 'OTP verified successfully',
    OTP_SENT_SUCCESS: 'OTP sent successfully',
  },
  USER: {
    GET_CURRENT_USER_SUCCESS: 'Current User Retrieved Successfully',
    CHANGE_EMAIL_SUCCESS:
      'Email Changed Successfully, check email for verification code',
    VERIFICATION_SUCCESS: 'Verification Successful',
    PIN_CREATED_SUCCESS: 'Transaction pin set successfully',
    PIN_UPDATED_SUCCESS: 'Transaction pin updated successfully',
  },
  WATCHLIST: {
    WATCHLIST_ADD_SUCCESS: 'Watchlist created successfully',
    WATCHLIST_REMOVE_SUCCESS: 'Watchlist removed successfully',
    WATCHLIST_GET_SUCCESS: 'Watchlist retrieved successfully',
  },
  WAITLIST: {
    JOIN_WAITLIST_SUCCESS:
      'You have joined the waitlist successfully. check email for confirmation',
  },
  CREDENTIAL: {
    UPLOAD_SUCCESS: 'Credential uploaded successfully',
    GET_SUCCESS: 'Credential retrieved successfully',
    VERIFICATION_SUCCESS: 'Credential verification processed successfully',
    VERIFICATION_REQUEST_SENT: 'Verification request sent successfully',
    VERIFICATION_REQUEST_RESENT: 'Verification request resent successfully',
    MINTING_RETRY_SUCCESS: 'Credential minting retry initiated successfully',
    DELETE_SUCCESS: 'Credential deleted successfully',
    UPDATE_SUCCESS: 'Credential updated successfully',
  },
  SETTINGS: {
    SETTINGS_CREATED_SUCCESS: 'Settings created successfully',
    SETTINGS_UPDATED_SUCCESS: 'Settings updated successfully',
    SETTINGS_DELETED_SUCCESS: 'Settings deleted successfully',
  },
  PREMIUM: {
    SELECT_PREMIUM_PLAN_SUCCESS: 'User plan selected successfully',
    PROCESS_PREMIUM_PAYMENT_SUCCESS: 'User upgraded to premium successfully',
  },
  CV: {
    DOWNLOAD_SUCCESS: 'CV Downloaded successfully',
    GENERATE_SUCCESS: 'CV Generated successfully',
    OPTIMIZED_SUCCESS: 'CV Optimized successfully',
    DRAFT_SAVED_SUCCESS: 'Draft saved successfully',
    DRAFT_UPDATED_SUCCESS: 'Draft updated successfully',
    DRAFT_RETRIEVED_SUCCESS: 'Draft retrieved successfully',
  },
};
