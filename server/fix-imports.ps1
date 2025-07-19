# Fix broken imports in TypeScript files

$files = Get-ChildItem -Path "src" -Recurse -Filter "*.ts"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Fix empty imports by restoring common patterns
    $content = $content -replace "import \{ serverConfig \} from '';", "import { serverConfig } from '@config/index';"
    $content = $content -replace "import \{ databaseConfig \} from '';", "import { databaseConfig } from '@config/index';"
    $content = $content -replace "import \{ securityConfig \} from '';", "import { securityConfig } from '@config/index';"
    $content = $content -replace "import \{ docusignConfig \} from '';", "import { docusignConfig } from '@config/index';"
    
    $content = $content -replace "import \{ logger \} from '';", "import { logger } from '@utils/logger';"
    $content = $content -replace "import \{ dbLogger \} from '';", "import { dbLogger } from '@utils/logger';"
    $content = $content -replace "import \{ authLogger \} from '';", "import { authLogger } from '@utils/logger';"
    $content = $content -replace "import \{ apiLogger \} from '';", "import { apiLogger } from '@utils/logger';"
    $content = $content -replace "import \{ auditLogger \} from '';", "import { auditLogger } from '@utils/logger';"
    
    $content = $content -replace "import \{ dbUtils \} from '';", "import { dbUtils } from '@utils/database';"
    $content = $content -replace "import \{ transaction \} from '';", "import { transaction } from '@utils/database';"
    $content = $content -replace "import \{ initializeDatabase \} from '';", "import { initializeDatabase } from '@utils/database';"
    
    $content = $content -replace "import \{ encrypt, decrypt \} from '';", "import { encrypt, decrypt } from '@utils/encryption';"
    $content = $content -replace "import \{ hashPassword, verifyPassword \} from '';", "import { hashPassword, verifyPassword } from '@utils/encryption';"
    
    # Fix types imports
    $content = $content -replace "import \{ ([^}]+) \} from '';", "import { `$1 } from '../types/index';"
    
    # Fix business types imports
    $content = $content -replace "} from '../types/businessTypes';", "} from '../types/businessTypes';"
    
    # Save if changed
    if ($content -ne $originalContent) {
        Set-Content $file.FullName $content
        Write-Host "Fixed imports in: $($file.FullName)"
    }
}

Write-Host "Import fixing complete!"
