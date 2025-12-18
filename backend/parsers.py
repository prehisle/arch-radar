import re
from typing import List, Dict, Any

def parse_weight_table(content: str) -> List[Dict[str, Any]]:
    """
    Parses the Knowledge Point Weight Table (Markdown).
    Expected columns: 序号 | 章节 | 知识点 | 出现频次 | 权重等级 | 数字化权重 | 考情精简分析
    """
    lines = content.split('\n')
    data = []
    
    # Simple table parser
    # Find header row first? Or just assume structure based on pipe
    for line in lines:
        if not line.strip().startswith('|'):
            continue
        if '---' in line:
            continue
        if '序号' in line and '章节' in line: # Header
            continue
            
        parts = [p.strip() for p in line.strip().split('|')]
        # Structure: | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
        # Split: ['', '1', '7.1.2...', 'KP', '23', '核心', '10', 'Analysis', '']
        # Indices: 0, 1(Seq), 2(Chapter), 3(Name), 4(Sub-KP), 5(Freq), 6(Level), 7(Score), 8(Analysis)
        
        if len(parts) < 9:
            continue
            
        try:
            item = {
                "chapter": parts[2],
                "name": parts[3],
                # parts[4] is Sub-KP (子知识点), we skip or store it if needed
                "frequency": int(parts[5]) if parts[5].isdigit() else 0,
                "weight_level": parts[6],
                "weight_score": int(parts[7]) if parts[7].isdigit() else 0,
                "analysis": parts[8]
            }
            data.append(item)
        except ValueError:
            continue # Skip invalid rows
            
    # Deduplicate: Keep item with highest weight_score for same name
    unique_data = {}
    for item in data:
        name = item['name']
        if name in unique_data:
            if item['weight_score'] > unique_data[name]['weight_score']:
                unique_data[name] = item
        else:
            unique_data[name] = item
            
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
        # Format 1: Past Papers
        chunks = re.split(r'^##\s+第\s+\d+\s+题', content, flags=re.MULTILINE)
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
                # Extract KP from format "**知识点**: ..."
                kp_match = re.search(r'\*\*知识点\*\*[:：]\s*(.*)', chunk)
                if kp_match:
                    kp_raw = kp_match.group(1).strip()
                    # Remove trailing newlines or empty lines that might have been captured if any
                    kp_raw = kp_raw.split('\n')[0].strip()

                # Extract Answer
                # Support multi-answer like **答案**：C,D or **答案**：C D
                answer_match = re.search(r'\*\*答案\*\*[:：]\s*([A-D](?:[,，\s]*[A-D])*)', chunk)
                if answer_match:
                    # Normalize answer "C, D" -> "C,D"
                    raw_ans = answer_match.group(1)
                    # Replace Chinese comma and spaces
                    raw_ans = re.sub(r'[,，\s]+', ',', raw_ans)
                    answer = raw_ans
                else:
                    answer = ""
                
                # Extract Explanation
                explanation_parts = re.split(r'\*\*解析\*\*[:：]', chunk)
                if len(explanation_parts) > 1:
                    explanation = explanation_parts[1].strip()
                    # Remove trailing separator if present (---)
                    # Match --- with surrounding newlines
                    explanation = re.split(r'\n\s*---\s*', explanation)[0].strip()
                
                # Body (Content + Options) is everything before Answer or Explanation
                body_limit = len(chunk)
                if answer_match:
                    body_limit = min(body_limit, answer_match.start())
                elif len(explanation_parts) > 1:
                    body_limit = min(body_limit, chunk.find('**解析**'))
                
                body_part = chunk[:body_limit]
                
                # Remove KP line from body part if it exists at the top
                if kp_match:
                    # Remove the KP line from body_part
                    body_part = body_part.replace(kp_match.group(0), "", 1)
                
                # Check if we have standard single choice or multiple sets
                # Pattern for single choice: just A, B, C, D once.
                # Pattern for multi type 1: A1... D1..., A2... D2...
                # Pattern for multi type 2: **(1)** ... A. ... Answer: X ... **(2)** ... A. ... Answer: Y
                
                # Check for Pattern 2 (Bracket headers like **(1)** or (1))
                # We look for explicit sub-question blocks
                sub_q_pattern = r'(\*\*\((\d+)\)\*\*|\((\d+)\))\s*\n'
                if re.search(sub_q_pattern, body_part) or re.search(sub_q_pattern, chunk):
                     # This is a complex multi-part question where answers might be interleaved
                     # We need to parse the entire chunk carefully, not just body_part
                     # Because answers are interleaved like: (1) ... Ans: A ... (2) ... Ans: B
                     
                     # Re-scan the full chunk
                     # Split by (1), (2), etc.
                     # Regex to find starting markers like **(1)** or (1)
                     # But be careful not to split inside text. These are usually headers.
                     
                     # Strategy: Find all indices of sub-questions
                     sub_matches = list(re.finditer(r'(?:^|\n)(?:\*\*\((\d+)\)\*\*|\((\d+)\))', chunk))
                     
                     if sub_matches:
                         options_groups = {}
                         answers_map = {}
                         
                         # Get general content (before first sub-question)
                         q_content = chunk[:sub_matches[0].start()].strip()
                         # Clean KP line if in q_content
                         if kp_match:
                             q_content = q_content.replace(kp_match.group(0), "", 1).strip()
                         
                         for i, match in enumerate(sub_matches):
                             idx_str = match.group(1) or match.group(2)
                             idx = int(idx_str)
                             
                             start = match.end()
                             end = sub_matches[i+1].start() if i + 1 < len(sub_matches) else len(chunk)
                             
                             sub_block = chunk[start:end]
                             
                             # Extract Options in this sub_block
                             # Find A. ...
                             opts_text_match = re.search(r'(?:^|\n)A\.', sub_block)
                             if opts_text_match:
                                 opts_text = sub_block[opts_text_match.start():]
                                 # Limit options text before Answer or Explanation or Next Sub Q (already limited by end)
                                 # Check for answer in sub_block
                                 ans_match = re.search(r'\*\*答案\*\*[:：]\s*([A-D])', sub_block)
                                 if ans_match:
                                     answers_map[idx] = ans_match.group(1)
                                     opts_text = sub_block[opts_text_match.start():ans_match.start()]
                                 
                                 current_opts = []
                                 opt_matches = re.findall(r'([A-D])\.\s+(.*?)(?=\n[A-Z]\.\s+|$)', opts_text, re.DOTALL)
                                 for label, text in opt_matches:
                                     current_opts.append(f"{label}. {text.strip()}")
                                 
                                 options_groups[idx] = current_opts
                         
                         # Construct final result
                         sorted_keys = sorted(options_groups.keys())
                         options = [options_groups[k] for k in sorted_keys]
                         
                         # Construct combined answer
                         # If answers found in sub-blocks, use them
                         if answers_map:
                             sorted_ans_keys = sorted(answers_map.keys())
                             answer = ",".join([answers_map[k] for k in sorted_ans_keys])
                         # Else fallback to global answer if valid
                         
                     else:
                         # Fallback to single logic if regex false positive
                         pass

                # Let's check for "A1." pattern
                elif re.search(r'(^|\n)A1\.', body_part):
                    # Multi-blank question
                    # Extract content until first A1.
                    opt_start_match = re.search(r'(^|\n)A1\.', body_part)
                    q_content = body_part[:opt_start_match.start()].strip()
                    opts_text = body_part[opt_start_match.start():]
                    
                    # We need to group options by index 1, 2, ...
                    # Find all option lines: [A-D][0-9]+
                    all_opts = re.findall(r'([A-D])(\d+)\.\s+(.*?)(?=\n[A-D]\d+\.|$)', opts_text, re.DOTALL)
                    
                    # Group by digit
                    grouped_opts = {} # { "1": ["A. xx", "B. xx"], "2": ... }
                    for label, idx, text in all_opts:
                        if idx not in grouped_opts:
                            grouped_opts[idx] = []
                        grouped_opts[idx].append(f"{label}. {text.strip()}")
                    
                    # Sort by index and convert to list of lists
                    # keys are strings "1", "2", convert to int for sort
                    sorted_keys = sorted(grouped_opts.keys(), key=lambda x: int(x))
                    options = [grouped_opts[k] for k in sorted_keys]
                    
                    # Sort options within each group (A, B, C, D)
                    for i in range(len(options)):
                        options[i].sort(key=lambda x: x[0]) # Sort by first char
                        
                else:
                    # Single choice
                    # Find first occurrence of "A. " at start of line
                    opt_start_match = re.search(r'(^|\n)A\.\s+', body_part)
                    
                    if opt_start_match:
                        q_content = body_part[:opt_start_match.start()].strip()
                        opts_text = body_part[opt_start_match.start():]
                        
                        # Split options A, B, C, D
                        opt_matches = re.findall(r'([A-D])\.\s+(.*?)(?=\n[A-Z]\.\s+|$)', opts_text, re.DOTALL)
                        for label, text in opt_matches:
                            options.append(f"{label}. {text.strip()}")
                    else:
                        q_content = body_part.strip()
                        options = []
                    
                # Clean up leading newlines in q_content
                q_content = q_content.strip()

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
