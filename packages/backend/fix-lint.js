const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        findFiles(filePath, fileList);
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = findFiles(srcDir);

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Fix setup.ts no-self-assign
  if (file.endsWith('setup.ts')) {
    content = content.replace(/process\.env\.JWT_SECRET = process\.env\.JWT_SECRET;?\s*/g, '');
  }

  // 2. Fix empty catch blocks and unused catch vars
  // empty catch(e){} -> catch(e) { console.error(e); }
  content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*(:\s*any)?\s*\)\s*\{\s*\}/g, 'catch ($1) { console.error($1); }');
  // empty catch { } -> catch (error) { console.error(error); }
  content = content.replace(/catch\s*\{\s*\}/g, 'catch (error) { console.error(error); }');

  // 3. Fix `error: any` in catch
  content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)/g, 'catch ($1: any)'); // Actually TS allows this, but to remove 'any' warning we can just remove type annotation or use unknown. Let's use `any` but in catch type annotations it throws `@typescript-eslint/no-explicit-any`. Let's use `: unknown` or remove type.
  content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)/g, 'catch ($1: unknown)');

  // 4. Fix other `error: any` in function signatures
  content = content.replace(/\(error:\s*any\)/g, '(error: unknown)');
  content = content.replace(/\(err:\s*any\)/g, '(err: unknown)');
  content = content.replace(/\(e:\s*any\)/g, '(e: unknown)');

  // Fix some generic any usages that are easy, like `catch (error: any)` inside the whole file
  content = content.replace(/catch\s*\(\s*error:\s*any\s*\)/g, 'catch (error: unknown)');
  content = content.replace(/catch\s*\(\s*e:\s*any\s*\)/g, 'catch (e: unknown)');

  // Write changes if modified
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
}
