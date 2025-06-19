#!/usr/bin/env zsh

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${BLUE}=== Testing alternative email providers ===${NC}"

# Create a backup of the current .env file
cp .env .env.backup
echo "${GREEN}✓ Created backup of current .env file as .env.backup${NC}"

# Function to test Gmail
test_gmail() {
  echo "${YELLOW}Setting up Gmail test configuration...${NC}"
  
  # Ask for Gmail credentials
  echo -n "Enter your Gmail address: "
  read gmail_user
  
  echo -n "Enter your Gmail app password (16 characters): "
  read -s gmail_password
  echo ""
  
  if [[ ${#gmail_password} -ne 16 ]]; then
    echo "${RED}⨯ The password doesn't look like a valid Gmail App Password (should be 16 characters).${NC}"
    echo "${YELLOW}Make sure you have enabled 2-Step Verification and generated an App Password at:${NC}"
    echo "https://myaccount.google.com/apppasswords"
    return 1
  fi
  
  # Update the .env file with Gmail configuration
  sed -i.tmp '
    /^SMTP_SERVICE=/d
    /^SMTP_HOST=/d
    /^SMTP_PORT=/d
    /^SMTP_USER=/d
    /^SMTP_PASSWORD=/d
    /^SMTP_EMAIL=/d
    /^SMTP_FROM=/d
  ' .env
  
  # Add Gmail configuration
  cat << EOF >> .env

# Gmail Configuration (Temporary)
SMTP_SERVICE="gmail"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="$gmail_user"
SMTP_EMAIL="$gmail_user"
SMTP_PASSWORD="$gmail_password"
SMTP_FROM='"Propellant HR Test" <$gmail_user>'
EOF
  
  echo "${GREEN}✓ Updated .env file with Gmail configuration${NC}"
  echo "${YELLOW}Starting the application to test Gmail configuration...${NC}"
  
  # Return success
  return 0
}

# Function to restore the original .env file
restore_env() {
  echo "${YELLOW}Restoring original .env file...${NC}"
  cp .env.backup .env
  echo "${GREEN}✓ Original .env file restored${NC}"
}

# Main execution
if test_gmail; then
  echo "${BLUE}The configuration has been updated to use Gmail.${NC}"
  echo "${BLUE}Test the email functionality with:${NC}"
  echo "${GREEN}curl -X GET 'http://localhost:5575/api/v1/mail/test?email=your-email@example.com'${NC}"
  
  echo "${YELLOW}When you're done testing, run this script again to restore your original configuration.${NC}"
  
  # Check if we need to restore
  if [[ -f .env.backup ]]; then
    echo -n "Would you like to restore the original configuration now? (y/n): "
    read restore_choice
    
    if [[ $restore_choice == "y" || $restore_choice == "Y" ]]; then
      restore_env
    else
      echo "${BLUE}The Gmail configuration will remain active.${NC}"
    fi
  fi
fi
