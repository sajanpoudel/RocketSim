import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface FormattedMessageProps {
  content: string;
  role: 'user' | 'assistant';
  className?: string;
}

// Detect if content is HTML vs markdown
const isHtmlContent = (content: string): boolean => {
  return content.includes('<p>') || content.includes('<h1>') || content.includes('<strong>') || content.includes('<div>');
};

// Convert HTML content to markdown-like format with proper LaTeX
const convertHtmlToMarkdown = (content: string): string => {
  console.log('🔧 Converting HTML to markdown');
  
  let processed = content;
  
  // Pattern 1: <p>\\[</p><p>formula content</p><p>\\]</p>
  processed = processed.replace(
    /<p>\\?\\\[<\/p>\s*<p>([\s\S]*?)<\/p>\s*<p>\\?\\\]<\/p>/g,
    (match, formulaContent) => {
      console.log('🔧 Found display math pattern 1:', formulaContent);
      return '\n\n$$' + formulaContent + '$$\n\n';
    }
  );
  
  // Pattern 2: <p>\\(</p><p>formula content</p><p>\\)</p>
  processed = processed.replace(
    /<p>\\?\\\(<\/p>\s*<p>([\s\S]*?)<\/p>\s*<p>\\?\\\)<\/p>/g,
    (match, formulaContent) => {
      console.log('🔧 Found inline math pattern 2:', formulaContent);
      return ' $' + formulaContent + '$ ';
    }
  );
  
  // Pattern 3: Single line with delimiters: <p>\\[ formula \\]</p>
  processed = processed.replace(
    /<p>\\?\\\[([\s\S]*?)\\?\\\]<\/p>/g,
    (match, formulaContent) => {
      console.log('🔧 Found display math pattern 3:', formulaContent);
      return '\n\n$$' + formulaContent + '$$\n\n';
    }
  );
  
  // Pattern 4: Single line with delimiters: <p>\\( formula \\)</p>
  processed = processed.replace(
    /<p>\\?\\\(([\s\S]*?)\\?\\\)<\/p>/g,
    (match, formulaContent) => {
      console.log('🔧 Found inline math pattern 4:', formulaContent);
      return ' $' + formulaContent + '$ ';
    }
  );
  
  // Pattern 5: Inline LaTeX within paragraphs
  processed = processed.replace(
    /\\?\\\(([\s\S]*?)\\?\\\)/g,
    (match, formulaContent) => {
      console.log('🔧 Found inline math pattern 5:', formulaContent);
      return '$' + formulaContent + '$';
    }
  );
  
  processed = processed.replace(
    /\\?\\\[([\s\S]*?)\\?\\\]/g,
    (match, formulaContent) => {
      console.log('🔧 Found display math pattern 6:', formulaContent);
      return '$$' + formulaContent + '$$';
    }
  );
  
  // Convert basic HTML to markdown
  processed = processed
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/g, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/g, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/g, '###### $1\n\n')
    .replace(/<p[^>]*>/g, '\n\n')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*')
    .replace(/<div class="bullet-list-container">/g, '\n')
    .replace(/<\/div>/g, '\n')
    .replace(/<div class="bullet-item">/g, '- ')
    .replace(/\n\n+/g, '\n\n') // Clean up multiple newlines
    .trim();
  
  console.log('🔧 HTML to markdown conversion complete');
  return processed;
};

// Simple, reliable LaTeX delimiter conversion (ChatGPT-style)
const preprocessMathDelimiters = (content: string): string => {
  console.log('🔍 preprocessMathDelimiters called with:', { content: content.substring(0, 200) + '...', type: typeof content, length: content?.length });
  
  if (!content || typeof content !== 'string') {
    console.log('❌ Content is invalid:', content);
    return content || '';
  }
  
  // Check if this is HTML content from agent
  if (isHtmlContent(content)) {
    console.log('📝 Detected HTML content, converting to markdown...');
    const converted = convertHtmlToMarkdown(content);
    console.log('🔄 HTML->Markdown conversion:', { 
      originalLength: content.length, 
      convertedLength: converted.length,
      originalPreview: content.substring(0, 200) + '...', 
      convertedPreview: converted.substring(0, 200) + '...' 
    });
    return converted;
  }
  
  // Only convert if we actually have LaTeX delimiters
  if (!content.includes('\\[') && !content.includes('\\(')) {
    console.log('✅ No LaTeX delimiters found, returning original content');
    return content;
  }
  
  try {
    const processed = content
      // Convert display math \[ ... \] to $$ ... $$
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
      // Convert inline math \( ... \) to $ ... $  
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
    
    console.log('🔄 LaTeX delimiters converted:', { 
      original: content.substring(0, 200) + '...', 
      processed: processed.substring(0, 200) + '...' 
    });
    return processed;
  } catch (error) {
    console.error('💥 Math delimiter conversion failed:', error);
    return content;
  }
};

// Enhanced sanitization schema that works with KaTeX
const createMathSafeSchema = () => {
  console.log('📋 Creating math-safe schema');
  const schema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      // Allow KaTeX-specific attributes
      div: [...(defaultSchema.attributes?.div || []), 'className'],
      span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
      // Allow MathML attributes that KaTeX might use
      math: ['xmlns', 'display'],
      semantics: [],
      mrow: [],
      mo: [],
      mi: [],
      mn: [],
      mfrac: [],
      msup: [],
      msub: [],
      msubsup: [],
      mtext: [],
      mspace: ['width'],
    },
    tagNames: [
      ...(defaultSchema.tagNames || []),
      // Allow KaTeX-generated elements
      'math', 'semantics', 'mrow', 'mo', 'mi', 'mn', 'mfrac', 
      'msup', 'msub', 'msubsup', 'mtext', 'mspace', 'mtable',
      'mtr', 'mtd', 'msqrt', 'mroot'
    ]
  };
  
  console.log('📋 Schema created with tagNames:', schema.tagNames?.length, 'tags');
  return schema;
};

export default function FormattedMessage({ content, role, className }: FormattedMessageProps) {
  console.log('🚀 FormattedMessage render:', { 
    role, 
    contentLength: content?.length, 
    contentPreview: content?.substring(0, 100) + '...',
    className 
  });

  if (role === 'user') {
    console.log('👤 Rendering user message');
    return (
      <p className={cn("whitespace-pre-wrap break-words text-black leading-relaxed text-sm", className)}>
        {content}
      </p>
    );
  }

  // Process content with error boundaries
  const processedContent = useMemo(() => {
    console.log('🔄 Processing content in useMemo...');
    try {
      if (!content || typeof content !== 'string') {
        console.log('❌ Invalid content in useMemo:', { content, type: typeof content });
        return '';
      }
      const result = preprocessMathDelimiters(content);
      console.log('✅ Content processed successfully:', { 
        originalLength: content.length, 
        processedLength: result.length,
        processedPreview: result.substring(0, 200) + '...'
      });
      return result;
    } catch (error) {
      console.error('💥 Content preprocessing failed in useMemo:', error);
      return content || '';
    }
  }, [content]);

  // Memoize the math-safe schema
  const mathSafeSchema = useMemo(() => {
    console.log('📋 Creating memoized math-safe schema');
    return createMathSafeSchema();
  }, []);

  console.log('📊 Before rendering:', {
    processedContent: !!processedContent,
    processedContentLength: processedContent?.length,
    processedContentPreview: processedContent?.substring(0, 100) + '...'
  });

  // Streamlined components with error handling
  const components = {
    h1: ({ children, ...props }: any) => {
      console.log('📝 Rendering h1:', children);
      return (
        <h1 className="text-xl font-bold text-white mt-4 mb-3 first:mt-0 border-b border-white/20 pb-2" {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ children, ...props }: any) => {
      console.log('📝 Rendering h2:', children);
      return (
        <h2 className="text-lg font-semibold text-white mt-4 mb-2 first:mt-0 border-l-3 border-blue-400 pl-3 bg-blue-400/5 py-2 rounded-r" {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }: any) => {
      console.log('📝 Rendering h3:', children);
      return (
        <h3 className="text-base font-medium text-white mt-3 mb-2 first:mt-0" {...props}>
          {children}
        </h3>
      );
    },
    p: ({ children, ...props }: any) => {
      console.log('📝 Rendering p:', children);
      return (
        <p className="text-white/90 leading-relaxed mb-3 last:mb-0 break-words text-sm" {...props}>
          {children}
        </p>
      );
    },
    strong: ({ children, ...props }: any) => {
      console.log('📝 Rendering strong:', children);
      return (
        <strong className="font-semibold text-white text-sm" {...props}>
          {children}
        </strong>
      );
    },
    em: ({ children, ...props }: any) => {
      console.log('📝 Rendering em:', children);
      return (
        <em className="italic text-blue-200 text-sm" {...props}>
          {children}
        </em>
      );
    },
    code: ({ inline, children, ...props }: any) => {
      console.log('📝 Rendering code:', { inline, children });
      if (inline) {
        return (
          <code className="bg-black/40 text-green-300 px-2 py-1 rounded text-xs font-mono border border-white/10" {...props}>
            {children}
          </code>
        );
      }
      return (
        <div className="my-4">
          <pre className="bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto">
            <code className="text-green-300 text-xs font-mono whitespace-pre block" {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },
    ul: ({ children, ...props }: any) => {
      console.log('📝 Rendering ul:', children);
      return (
        <ul className="space-y-2 mb-4 ml-0 text-sm" {...props}>
          {children}
        </ul>
      );
    },
    ol: ({ children, ...props }: any) => {
      console.log('📝 Rendering ol:', children);
      return (
        <ol className="space-y-2 mb-4 ml-6 list-decimal text-sm" {...props}>
          {children}
        </ol>
      );
    },
    li: ({ children, ...props }: any) => {
      console.log('📝 Rendering li:', children);
      return (
        <li className="text-white/90 flex items-start gap-3 text-sm" {...props}>
          <span className="text-blue-400 mt-2 text-xs flex-shrink-0">•</span>
          <span className="flex-1 break-words">{children}</span>
        </li>
      );
    },
    blockquote: ({ children, ...props }: any) => {
      console.log('📝 Rendering blockquote:', children);
      return (
        <blockquote className="border-l-4 border-blue-500 pl-4 my-4 bg-blue-500/5 py-3 rounded-r-lg italic text-blue-100 text-sm" {...props}>
          {children}
        </blockquote>
      );
    },
    table: ({ children, ...props }: any) => {
      console.log('📝 Rendering table:', children);
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full border-collapse bg-black/20 text-sm" {...props}>
            {children}
          </table>
        </div>
      );
    },
    th: ({ children, ...props }: any) => {
      console.log('📝 Rendering th:', children);
      return (
        <th className="border border-white/10 bg-white/5 px-3 py-2 text-left font-medium text-white text-sm" {...props}>
          {children}
        </th>
      );
    },
    td: ({ children, ...props }: any) => {
      console.log('📝 Rendering td:', children);
      return (
        <td className="border border-white/10 px-3 py-2 text-white/90 break-words text-sm" {...props}>
          {children}
        </td>
      );
    },
    a: ({ children, href, ...props }: any) => {
      console.log('📝 Rendering a:', { children, href });
      return (
        <a 
          href={href}
          className="text-blue-400 hover:text-blue-300 underline transition-colors break-all text-sm"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    hr: ({ ...props }: any) => {
      console.log('📝 Rendering hr');
      return (
        <hr className="border-none h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-6" {...props} />
      );
    },
  };

  // Fallback rendering if content processing fails
  if (!processedContent) {
    console.log('❌ No processed content, rendering fallback');
    return (
      <div className={cn("prose prose-invert max-w-none overflow-hidden text-white formatted-content", className)}>
        <p className="text-white/90 leading-relaxed mb-3 text-sm">
          {content || 'Content could not be processed'}
        </p>
      </div>
    );
  }

  console.log('🎯 About to render ReactMarkdown with:', {
    contentLength: processedContent.length,
    hasRemarkPlugins: true,
    hasRehypePlugins: true,
    hasComponents: Object.keys(components).length
  });

  try {
    return (
      <div className={cn("prose prose-invert max-w-none overflow-hidden text-white formatted-content", className)}>
        <ReactMarkdown
          remarkPlugins={[
            [remarkMath, { singleDollarTextMath: true }]
          ]}
          rehypePlugins={[
            // CRITICAL: rehype-katex MUST come before rehype-sanitize
            [rehypeKatex, { 
              strict: false,
              throwOnError: false,
              errorColor: '#ff6b6b',
              output: 'html',
              trust: true, // Allow KaTeX to render all math
              macros: {
                // Common math macros for better compatibility
                '\\RR': '\\mathbb{R}',
                '\\CC': '\\mathbb{C}',
                '\\NN': '\\mathbb{N}',
                '\\ZZ': '\\mathbb{Z}',
                '\\QQ': '\\mathbb{Q}'
              }
            }],
            // Sanitize AFTER math rendering to preserve KaTeX output
            [rehypeSanitize, mathSafeSchema]
          ]}
          components={components}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  } catch (error) {
    console.error('💥 ReactMarkdown rendering failed:', error);
    return (
      <div className={cn("prose prose-invert max-w-none overflow-hidden text-white formatted-content", className)}>
        <p className="text-red-400 leading-relaxed mb-3 text-sm">
          Error rendering content: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <pre className="text-xs text-gray-400 mt-2 bg-black/20 p-2 rounded">
          {processedContent}
        </pre>
      </div>
    );
  }
} 