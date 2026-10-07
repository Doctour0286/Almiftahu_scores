import React, { useRef, useState } from 'react';
import { UploadCloud, X, Check, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  description?: string;
  value?: string; // Data URL or URL
  onChange: (dataUrl: string) => void;
  aspectRatioHint?: string;
  previewHeightClass?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  description,
  value,
  onChange,
  aspectRatioHint = 'PNG, JPG, SVG, WebP (بحد أقصى 5 ميجابايت)',
  previewHeightClass = 'h-24'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processFile = (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('الملف المحدد ليس صورة صالحة. يرجى اختيار ملف صورة.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onChange(result);
      }
    };
    reader.onerror = () => {
      setErrorMsg('حدث خطأ أثناء قراءة الصورة. يرجى المحاولة مرة أخرى.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5 text-right" dir="rtl">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-stone-800">
          {label}
        </label>
        {value && (
          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> تم تحميل الصورة
          </span>
        )}
      </div>

      {description && (
        <p className="text-xs text-stone-500 leading-relaxed">{description}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative group border border-emerald-300/80 bg-emerald-50/20 rounded-xl p-3 flex items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`p-1.5 bg-white border border-stone-200 rounded-lg shadow-xs flex items-center justify-center shrink-0 ${previewHeightClass}`}>
              <img
                src={value}
                alt={label}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="text-right overflow-hidden">
              <span className="text-xs font-semibold text-stone-800 block truncate">
                معاينة {label}
              </span>
              <span className="text-[11px] text-stone-500 block">
                ملف صورة مخزن ومحفوظ بنجاح
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors shadow-2xs"
            >
              استبدال
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="إزالة الصورة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-600 bg-emerald-50/50'
              : 'border-stone-300 hover:border-emerald-600/70 hover:bg-stone-50/60 bg-white/70'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="text-xs font-medium text-stone-800">
              انقر لرفع ملف الصورة، أو اسحب الصورة وأفلتها هنا
            </div>
            <div className="text-[11px] text-stone-600">
              {aspectRatioHint}
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-rose-600 font-medium mt-1">{errorMsg}</p>
      )}
    </div>
  );
};
