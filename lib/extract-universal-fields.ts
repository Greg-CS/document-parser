/**
 * Extract universal fields from credit report data
 */

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  
  const keys = path.split(".");
  let current: any = obj;
  
  for (const key of keys) {
    if (current == null) return undefined;
    
    // Handle array notation like BORROWER[0]
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch;
      current = current[arrayKey]?.[parseInt(index)];
    } else {
      current = current[key];
    }
  }
  
  return current;
}

export interface UniversalFields {
  firstName?: string;
  lastName?: string;
  ssnLast4?: string;
  dateOfBirth?: Date;
  accountNumber?: string;
  accountType?: string;
  accountStatus?: string;
  balance?: number;
  openedDate?: Date;
  closedDate?: Date;
}

export function extractUniversalFields(data: Record<string, unknown>): UniversalFields {
  const fields: UniversalFields = {};

  // Extract borrower/personal info
  const borrowerPaths = [
    "CREDIT_RESPONSE.BORROWER[0]",
    "CREDIT_RESPONSE._BORROWER[0]",
    "BORROWER[0]",
    "_BORROWER[0]",
  ];

  for (const basePath of borrowerPaths) {
    const borrower = getValueAtPath(data, basePath);
    if (borrower && typeof borrower === "object") {
      const b = borrower as Record<string, any>;
      
      // First name
      fields.firstName = fields.firstName || 
        b["@_FirstName"] || b["@FirstName"] || b["_NAME"]?.["@_FirstName"];
      
      // Last name
      fields.lastName = fields.lastName || 
        b["@_LastName"] || b["@LastName"] || b["_NAME"]?.["@_LastName"];
      
      // SSN last 4
      const ssn = b["@_SSN"] || b["@SSN"] || b["_TAXPAYER_IDENTIFIER"]?.["@_IdentifierValue"];
      if (ssn && typeof ssn === "string") {
        fields.ssnLast4 = fields.ssnLast4 || ssn.slice(-4);
      }
      
      // Date of birth
      const dob = b["@_BirthDate"] || b["@BirthDate"];
      if (dob && typeof dob === "string") {
        const parsed = new Date(dob);
        if (!isNaN(parsed.getTime())) {
          fields.dateOfBirth = fields.dateOfBirth || parsed;
        }
      }
    }
  }

  // Extract first account info (if available)
  const accountPaths = [
    "CREDIT_RESPONSE.CREDIT_LIABILITY[0]",
    "CREDIT_RESPONSE._CREDIT_LIABILITY[0]",
    "CREDIT_LIABILITY[0]",
    "_CREDIT_LIABILITY[0]",
  ];

  for (const basePath of accountPaths) {
    const account = getValueAtPath(data, basePath);
    if (account && typeof account === "object") {
      const a = account as Record<string, any>;
      
      // Account number
      fields.accountNumber = fields.accountNumber || 
        a["@_AccountIdentifier"] || a["@AccountIdentifier"] || 
        a["_CREDIT_LOAN_IDENTIFIER"]?.["@_CreditLoanIdentifier"];
      
      // Account type
      fields.accountType = fields.accountType || 
        a["@_AccountType"] || a["@AccountType"] || 
        a["_CREDIT_LOAN_IDENTIFIER"]?.["@_CreditLoanType"];
      
      // Account status
      fields.accountStatus = fields.accountStatus || 
        a["@_AccountStatusType"] || a["@AccountStatusType"];
      
      // Balance
      const balance = a["@_UnpaidBalanceAmount"] || a["@UnpaidBalanceAmount"] || 
        a["_CREDIT_SUMMARY"]?.["@_UnpaidBalanceAmount"];
      if (balance != null) {
        const num = typeof balance === "number" ? balance : parseFloat(String(balance));
        if (!isNaN(num)) {
          fields.balance = fields.balance ?? num;
        }
      }
      
      // Opened date
      const openedDate = a["@_AccountOpenedDate"] || a["@AccountOpenedDate"];
      if (openedDate && typeof openedDate === "string") {
        const parsed = new Date(openedDate);
        if (!isNaN(parsed.getTime())) {
          fields.openedDate = fields.openedDate || parsed;
        }
      }
      
      // Closed date
      const closedDate = a["@_AccountClosedDate"] || a["@AccountClosedDate"];
      if (closedDate && typeof closedDate === "string") {
        const parsed = new Date(closedDate);
        if (!isNaN(parsed.getTime())) {
          fields.closedDate = fields.closedDate || parsed;
        }
      }
      
      break; // Only use first account
    }
  }

  return fields;
}
