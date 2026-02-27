import re
from typing import List, Dict, Any

def clean_markdown(text: str) -> str:
    """Removes markdown syntax like **, *, __, etc."""
    if not text:
        return ""
    # Remove bold/italic (**text** or *text* or __text__)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    return text.strip()

def parse_weight_table(content: str) -> List[Dict[str, Any]]:
    """
    Parses the Knowledge Point Weight Table (Markdown).
    Supports two modes:
    1. Standard (SysArch): | 序号 | 章节 | 知识点 | 子知识点 | 出现频次 | 权重等级 | 数字化权重 | 考情精简分析 |
    2. Extended (PM):      | 序号 | 章节 | 子章节 | 知识点 | 子知识点 | 出现频次 | 权重等级 | 数字化权重 | 考情精简分析 |
    """
    lines = content.split('\n')
    data = []
    
    header_found = False
    has_sub_chapter = False
    
    # 1. Identify Header Structure
    for line in lines:
        if not line.strip().startswith('|'):
            continue
        if '---' in line:
            continue
            
        # Detect header row
        if '序号' in line and '章节' in line and '知识点' in line:
            header_found = True
            headers = [h.strip() for h in line.strip().split('|') if h.strip()]
            if '子章节' in headers:
                has_sub_chapter = True
            break
            
    if not header_found:
        # Default to standard if no header found (fallback)
        pass

    # 2. Parse Rows
    for line in lines:
        if not line.strip().startswith('|'):
            continue
        if '---' in line:
            continue
        if '序号' in line and '章节' in line: # Header
            continue
            
        parts = [p.strip() for p in line.strip().split('|')]
        
        # parts[0] is empty (before first |), parts[1] is 序号
        # Clean parts list
        parts = [p.strip() for p in parts if p.strip()]
        
        # Standard: 序号 | 章节 | 知识点 | 子知识点 | 出现频次 | 权重等级 | 数字化权重 | 考情精简分析
        # Extended: 序号 | 章节 | 子章节 | 知识点 | 子知识点 | 出现频次 | 权重等级 | 数字化权重 | 考情精简分析
        
        try:
            item = {}
            if has_sub_chapter:
                # Extended Mapping
                # 0: 序号
                # 1: 章节
                # 2: 子章节
                # 3: 知识点
                # 4: 子知识点
                # 5: 出现频次
                # 6: 权重等级
                # 7: 数字化权重
                # 8: 考情精简分析
                
                if len(parts) < 8: continue

                item["chapter"] = clean_markdown(parts[1])
                item["sub_chapter"] = clean_markdown(parts[2])
                item["name"] = clean_markdown(parts[3])
                # sub_knowledge_point = parts[4] (ignored for now?)
                
                freq_idx = 5
                level_idx = 6
                score_idx = 7
                analysis_idx = 8
                
                if len(parts) > freq_idx and parts[freq_idx].isdigit():
                     item["frequency"] = int(parts[freq_idx])
                else:
                     item["frequency"] = 0
                     
                item["weight_level"] = clean_markdown(parts[level_idx]) if len(parts) > level_idx else "一般"
                
                if len(parts) > score_idx and parts[score_idx].isdigit():
                    item["weight_score"] = int(parts[score_idx])
                else:
                    item["weight_score"] = 0
                    
                item["analysis"] = clean_markdown(parts[analysis_idx]) if len(parts) > analysis_idx else ""
                
            else:
                # Standard Mapping (SysArch)
                # 0: 序号
                # 1: 章节
                # 2: 知识点
                # 3: 子知识点
                # 4: 出现频次
                # 5: 权重等级
                # 6: 数字化权重
                # 7: 考情精简分析
                
                if len(parts) < 7: continue

                item["chapter"] = clean_markdown(parts[1])
                item["name"] = clean_markdown(parts[2])
                
                item["frequency"] = int(parts[4]) if parts[4].isdigit() else 0
                item["weight_level"] = clean_markdown(parts[5]) if len(parts) > 5 else "一般"
                item["weight_score"] = int(parts[6]) if len(parts) > 6 and parts[6].isdigit() else 0
                item["analysis"] = clean_markdown(parts[7]) if len(parts) > 7 else ""
            
            data.append(item)
        except (ValueError, IndexError) as e:
            print(f"Error parsing chunk: {e}")
            print(f"Chunk content: {line[:100]}...")
            continue # Skip invalid rows
            
    # Deduplicate: Keep item with highest weight_score for same name (and sub_chapter if exists)
    unique_data = {}
    for item in data:
        # Unique key depends on mode
        if has_sub_chapter:
            key = f"{item['chapter']}|{item['sub_chapter']}|{item['name']}"
        else:
            key = item['name']
            
        if key in unique_data:
            if item['weight_score'] > unique_data[key]['weight_score']:
                unique_data[key] = item
        else:
            unique_data[key] = item
            
    return list(unique_data.values())

def parse_questions(content: str, source_type: str) -> List[Dict[str, Any]]:
    """
    Parses questions from Markdown.
    Supports two formats:
    1. Past Paper Format:
       ## 第 N 题
       Content...
       A. ...
       **答案**: ...
       **解析**: ...
       
    2. Exercise Format:
       #### N. 题目
       **题干**：...
       A. ...
       **答案**：...
    """
    questions = []
    
    # Determine format
    if '## 第' in content:
        # Format 1: Past Papers (Standard SysArch)
        chunks = re.split(r'^##\s*第\s*\d+\s*题', content, flags=re.MULTILINE)
        mode = "past_paper"
    elif '# 综合知识-' in content:
        # Format 4: Past Papers (PM High Level) - Starts with Title
        chunks = re.split(r'^##\s*第\s*\d+\s*题', content, flags=re.MULTILINE)
        mode = "past_paper"
    elif '# 题目：序号' in content:
        # Format 3: Exercises with Knowledge Points
        chunks = re.split(r'^#\s+题目：序号.*$', content, flags=re.MULTILINE)
        mode = "exercise_kp"
    else:
        # Format 2: Exercises
        chunks = re.split(r'^####\s+\d+\.?\s+题目', content, flags=re.MULTILINE)
        mode = "exercise"
    
    for chunk in chunks:
        if not chunk.strip():
            continue
            
        try:
            q_content = ""
            options = []
            answer = ""
            explanation = ""
            kp_raw = ""

            if mode == "past_paper":
                # Use a copy of chunk for modification to extract body
                body = chunk
                
                # 1. Extract and Remove KP
                kp_match = re.search(r'(\*\*知识点\*\*[:：]\s*.*)', body)
                if kp_match:
                    kp_full_str = kp_match.group(1)
                    kp_raw = re.sub(r'\*\*知识点\*\*[:：]\s*', '', kp_full_str).strip()
                    kp_raw = kp_raw.split('\n')[0].strip()
                    # Remove the KP line
                    body = body.replace(kp_full_str, "")

                # 2. Extract and Remove Answer
                answer_match = re.search(r'(\*\*答案\*\*[:：]\s*([A-D](?:[,，\s]*[A-D])*))', body)
                if answer_match:
                    ans_full_str = answer_match.group(1)
                    raw_ans = answer_match.group(2)
                    raw_ans = re.sub(r'[,，\s]+', ',', raw_ans)
                    answer = raw_ans
                    body = body.replace(ans_full_str, "")
                else:
                    answer = ""

                # 3. Extract and Remove Explanation
                expl_match = re.search(r'(\*\*解析\*\*[:：][\s\S]*)', body)
                if expl_match:
                     expl_full_str = expl_match.group(1)
                     explanation = re.sub(r'\*\*解析\*\*[:：]', '', expl_full_str).strip()
                     explanation = re.split(r'\n\s*---\s*', explanation)[0].strip()
                     body = body.replace(expl_full_str, "")

                # 4. Clean Body and Handle Options
                body_part = body.strip()

                # Check for Pattern 2 (Bracket headers like **(1)** or (1))
                # This indicates a multi-blank question with separate option groups
                # Pattern: 
                # **(1)** 
                # A. ...
                # B. ...
                # 
                # **(2)**
                # A. ...
                
                sub_q_pattern = r'(?:^|\n)\s*(\*\*[\(（]\d+[\)）]\*\*|[\(（]\d+[\)）])'
                if re.search(sub_q_pattern, body_part):
                     # This is a multi-part question
                     # Strategy:
                     # 1. Split body into Main Question Text and Sub-Question Blocks
                     # 2. Parse each block for options
                     
                     # Find the first occurrence of (1) or **(1)**
                     first_sub_match = re.search(sub_q_pattern, body_part)
                     
                     q_content_main = body_part[:first_sub_match.start()].strip()
                     remaining_body = body_part[first_sub_match.start():]
                     
                     # Split remaining body by (N) pattern
                     # Use capturing group to keep the delimiters
                     # re.split behavior with capturing group: [text_before, delimiter, text_after, delimiter, ...]
                     # But delimiter itself is part of the split.
                     
                     # Better: find all starts
                     sub_matches = list(re.finditer(sub_q_pattern, body_part))
                     
                     all_options = []
                     
                     for i, match in enumerate(sub_matches):
                         start = match.end()
                         end = sub_matches[i+1].start() if i + 1 < len(sub_matches) else len(body_part)
                         
                         sub_block = body_part[start:end].strip()
                         
                         # Parse options in this block
                         # Look for "A. ", "B. " etc.
                         current_sub_options = []
                         # Allow A. B. C. D. on same line or different lines
                         # Normalize newlines for easier regex
                         sub_block_norm = re.sub(r'\s+([A-D]\.)', r'\n\1', sub_block)
                         
                         opt_matches = re.findall(r'(?:^|\n)\s*([A-D])\.\s*(.*?)(?=\n\s*[A-D]\.|$)', sub_block_norm, re.DOTALL)
                         
                         for label, text in opt_matches:
                             current_sub_options.append(f"{label}. {text.strip()}")
                         
                         if current_sub_options:
                             all_options.append(current_sub_options)
                         else:
                             # Fallback: if no options found, maybe it's just text?
                             # Or maybe options are formatted differently?
                             # Just append empty list to keep index alignment
                             all_options.append([])

                     questions.append({
                        "content": q_content_main, 
                        "options": all_options, # List of Lists
                        "answer": answer, # "D、B、C" or "D,B,C" -> Normalize to "D,B,C"
                        "explanation": explanation, 
                        "kp_raw": kp_raw, 
                        "source_type": source_type
                     })
                     continue

                # Standard case (Single Choice)
                # Extract Options from body_part if present
                # Find first "A." at start of line or after newline
                opt_start_match = re.search(r'(?:^|\n)\s*A\.', body_part)
                
                if opt_start_match:
                    q_text = body_part[:opt_start_match.start()].strip()
                    opts_text = body_part[opt_start_match.start():]
                    
                    current_options = []
                    # Normalize: ensure A. B. C. D. start on new lines if they are compacted
                    opts_text_norm = re.sub(r'\s+([B-D]\.)', r'\n\1', opts_text)
                    
                    # Regex looks for "X. " at start of line
                    opt_matches = re.findall(r'(?:^|\n)\s*([A-Z])\.\s*(.*?)(?=\n\s*[A-Z]\.|$)', opts_text_norm, re.DOTALL)
                    
                    for label, text in opt_matches:
                        current_options.append(f"{label}. {text.strip()}")
                        
                    questions.append({
                        "content": q_text, 
                        "options": current_options, 
                        "answer": answer, 
                        "explanation": explanation, 
                        "kp_raw": kp_raw, 
                        "source_type": source_type
                    })
                else:
                    # No options found (maybe fill-in-the-blank or essay), treat whole body as content
                    questions.append({
                        "content": body_part, 
                        "options": [], 
                        "answer": answer, 
                        "explanation": explanation, 
                        "kp_raw": kp_raw, 
                        "source_type": source_type
                    })
                continue

            elif mode == "exercise_kp":
                # Format:
                # **题干** ：...
                # A. ...
                # **答案** ：C
                # **解析** ：...
                # **关联知识点** ：...

                # Content
                content_match = re.search(r'\*\*题干\*\*\s*[:：](.*?)(?=\n\s*[A-Z]\.)', chunk, re.DOTALL)
                q_content = content_match.group(1).strip() if content_match else ""

                # Options
                # Options are between content and Answer
                # Find start of options (A.)
                opt_start_match = re.search(r'\n\s*A\.', chunk)
                answer_start_match = re.search(r'\n\*\*答案\*\*', chunk)
                
                if opt_start_match and answer_start_match:
                    opts_text = chunk[opt_start_match.start():answer_start_match.start()]
                    opt_matches = re.findall(r'([A-Z])\.\s+(.*?)(?=\n\s*[A-Z]\.|$)', opts_text, re.DOTALL)
                    for label, text in opt_matches:
                        options.append(f"{label}. {text.strip()}")

                # Answer
                answer_match = re.search(r'\*\*答案\*\*\s*[:：]\s*([A-D])', chunk)
                answer = answer_match.group(1) if answer_match else ""

                # Explanation
                explanation_match = re.search(r'\*\*解析\*\*\s*[:：](.*?)(?=\*\*关联知识点\*\*|$)', chunk, re.DOTALL)
                explanation = explanation_match.group(1).strip() if explanation_match else ""

                # KP
                kp_match = re.search(r'\*\*关联知识点\*\*\s*[:：](.*)', chunk)
                kp_raw = kp_match.group(1).strip() if kp_match else ""

            else:
                # Old Format (Exercise)
                # Content (题干)
                content_match = re.search(r'\*\*题干\*\*：(.*?)(?=\n[A-Z]\.)', chunk, re.DOTALL)
                if not content_match:
                    content_match = re.search(r'\*\*题干\*\*：(.*?)(?=\n\s*[A-Z]\.)', chunk, re.DOTALL)
                
                q_content = content_match.group(1).strip() if content_match else ""
                
                # Options
                option_matches = re.findall(r'([A-Z])\.\s+(.*?)(?=\n[A-Z]\.|\n\*\*答案\*\*|$)', chunk, re.DOTALL)
                for opt_label, opt_text in option_matches:
                    options.append(f"{opt_label}. {opt_text.strip()}")
                
                # Answer
                answer_match = re.search(r'\*\*答案\*\*[:：]([A-D])', chunk)
                answer = answer_match.group(1) if answer_match else ""
                
                # Explanation
                explanation_match = re.search(r'\*\*解析\*\*[:：](.*?)(?=\*\*关联知识点\*\*|$)', chunk, re.DOTALL)
                explanation = explanation_match.group(1).strip() if explanation_match else ""
                
                # Knowledge Point
                kp_match = re.search(r'\*\*关联知识点\*\*[:：](.*)', chunk)
                kp_raw = kp_match.group(1).strip() if kp_match else ""

            if not q_content and not options:
                continue
            
            # Skip metadata/preamble chunks that don't have an answer
            if mode == "past_paper" and not answer:
                 continue

            questions.append({
                "content": q_content,
                "options": options,
                "answer": answer,
                "explanation": explanation,
                "source_type": source_type,
                "kp_raw": kp_raw
            })
            
        except Exception as e:
            print(f"Error parsing chunk: {e}")
            continue
            
    return questions

def parse_syllabus(content: str) -> List[Dict[str, Any]]:
    """
    Parses the Exam Syllabus (Markdown).
    Format:
    # 1. Subject
    ## 1.1 Chapter
    ### 1.1.1 Section
    - Knowledge Point
    
    Only returns items with type="point" (Knowledge Points).
    The 'chapter' field will contain the name of the immediate parent structure (e.g., Section name).
    """
    lines = content.split('\n')
    hierarchy_stack = [] # Stack of (level, name)
    items = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Parse Levels
        if line.startswith('#'):
            level = line.count('#')
            text = line.replace('#', '').strip()
            
            # Pop stack if current level is <= stack top level
            while hierarchy_stack and hierarchy_stack[-1]['level'] >= level:
                hierarchy_stack.pop()
                
            item = {
                "name": text,
                "level": level,
                "type": "structure"
            }
            hierarchy_stack.append(item)
                
        elif line.startswith('-'):
            # Leaf node (Knowledge Point)
            text = line[1:].strip()
            
            # Direct parent is the last item in stack
            parent = hierarchy_stack[-1] if hierarchy_stack else None
            chapter_name = parent['name'] if parent else "General"
            
            item = {
                "name": text,
                "level": 99, # Leaf
                "parent_name": None, # We don't need parent linking for structure anymore as we flatten
                "chapter": chapter_name, # Direct parent name
                "type": "point",
                "description": ""
            }
            items.append(item)
            
        elif line.strip() and items and items[-1]['type'] == 'point':
            # Append indented text to previous item's description
            items[-1]['description'] += line.strip() + "\n"
            
    return items
