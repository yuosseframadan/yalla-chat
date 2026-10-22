YALLA CHAT — إصدار واجهة وتثبيت محسّن
رابط Realtime Database: https://yalla-chat-286b2-default-rtdb.europe-west1.firebasedatabase.app

النشر:
1) ارفع محتويات مجلد yalla-chat إلى GitHub ثم Vercel.
2) Firebase Console > Authentication > Sign-in method: فعّل Email/Password وGoogle.
3) في Google provider عيّن بريد الدعم إن طلبه Firebase.
4) Authentication > Settings > Authorized domains: أضف نطاق Vercel.
5) Realtime Database > Rules: انشر database.rules.json من وحدة تحكم Firebase وليس من Vercel.
6) اختبر حسابين قبل نشر الموقع للناس.

مهم: إضافة Google في الواجهة لا تعمل حتى تفعيل Google provider وإضافة نطاق Vercel إلى Authorized domains.
تثبيت iPhone: افتح الموقع في Safari > مشاركة > Add to Home Screen > Add.
في Android/Chrome تظهر نافذة التثبيت عندما يسمح المتصفح بذلك. لا يمكن للموقع فرض تثبيت صامت.
خطة Firebase المجانية ليست بلا حدود: Realtime Database Spark يشمل 1GB تخزين و10GB تنزيلات شهرياً وحد اتصال متزامن؛ راقب Usage. الحذف التلقائي الموثوق يحتاج مهمة خلفية مجدولة، وحذف العميل وحده غير كافٍ.
الإصدار لم يُختبر ضد قاعدة Firebase الحية من هنا. اختبر قواعد الأمان في Firebase Rules Simulator قبل الاعتماد عليه.


تحديث إصلاح الرسائل وتسجيل الدخول:
- تسجيل الدخول مضبوط على browserLocalPersistence؛ الحساب يظل مسجلاً على نفس نطاق الموقع حتى تضغط خروج، ما دام المتصفح يسمح بالتخزين المحلي.
- إرسال الرسالة يظهر فوراً بحالة جارٍ الإرسال، ولا ينتظر تحديث معاينة المحادثة حتى يفتح الإرسال التالي. إذا رفضت Firebase الرسالة، تظهر كفشل مع زر إعادة الإرسال ويظهر سبب الخطأ.
- بعد الخروج يتم إيقاف مستمعي المحادثات وتصفير بيانات الحساب من الواجهة حتى يمكن الدخول بحساب آخر بشكل نظيف.
- بعد تحديث الملفات، ارفع مجلد yalla-chat كاملاً إلى نفس مشروع Vercel. إذا استمر إصدار قديم في PWA، أغلق التطبيق وافتحه مجدداً أو أعد تحميل الموقع.
- يجب اختبار الإرسال بين حسابين على Firebase الحقيقي؛ لم يمكن تنفيذ اختبار حي لقاعدة بياناتك من بيئة التحرير.
