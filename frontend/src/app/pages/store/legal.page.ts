import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { SiteSettingsService } from '../../core/services/site-settings.service';
import { TPipe } from '../../shared/pipes/i18n.pipes';

interface Section {
  fr: [string, string];
  ar: [string, string];
}

// TEMPLATE TEXT — it describes what this software actually does with personal data. Have a lawyer review it and
// fill the [bracketed] placeholders (company name, ICE, CNDP receipt number…) before going live.
const PRIVACY: Section[] = [
  {
    fr: ['1. Qui sommes-nous ?', 'Le site est exploité par [Raison sociale / nom commercial], [adresse], ICE [numéro]. Pour toute question relative à vos données : voir la page Contact.'],
    ar: ['1. من نحن؟', 'يُدار الموقع من طرف [الاسم التجاري]، [العنوان]، ICE [الرقم]. لأي سؤال يتعلق ببياناتك: راجع صفحة اتصل بنا.'],
  },
  {
    fr: ['2. Données collectées', 'Lors d’une commande : nom, numéro de téléphone, adresse de livraison, ville, e-mail (facultatif), note pour le livreur et contenu de la commande. Via le formulaire de contact : nom, e-mail/téléphone (facultatifs) et message. Nous ne collectons aucune donnée de carte bancaire : le paiement se fait en espèces à la livraison.'],
    ar: ['2. البيانات المجمّعة', 'عند الطلب: الاسم، رقم الهاتف، عنوان التوصيل، المدينة، البريد الإلكتروني (اختياري)، ملاحظة لعامل التوصيل ومحتوى الطلب. عبر نموذج الاتصال: الاسم والبريد/الهاتف (اختياري) والرسالة. لا نجمع أي بيانات بطاقة بنكية: الدفع نقدًا عند الاستلام.'],
  },
  {
    fr: ['3. Pourquoi nous les utilisons', 'Uniquement pour : traiter et livrer votre commande, vous appeler pour la confirmer, répondre à vos messages, gérer la comptabilité et le service après-vente, et sécuriser le site. Vos données ne sont ni vendues ni utilisées pour de la publicité.'],
    ar: ['3. لماذا نستعملها', 'فقط من أجل: معالجة وتوصيل طلبك، الاتصال بك لتأكيده، الرد على رسائلك، المحاسبة وخدمة ما بعد البيع، وتأمين الموقع. لا تُباع بياناتك ولا تُستعمل للإشهار.'],
  },
  {
    fr: ['4. Qui y a accès', 'L’équipe de la boutique (accès protégé par mot de passe) et, pour la livraison uniquement, le transporteur/livreur. Notre hébergeur technique stocke les données de manière sécurisée.'],
    ar: ['4. من يطّلع عليها', 'فريق المتجر (بوصول محمي بكلمة مرور) وشركة/عامل التوصيل لأجل التسليم فقط. ويخزّن المضيف التقني البيانات بشكل آمن.'],
  },
  {
    fr: ['5. Durée de conservation', 'Les données d’identification d’une commande sont conservées le temps nécessaire à la livraison et au service après-vente, puis anonymisées. Seules les informations comptables obligatoires sont conservées pendant la durée légale. Les messages de contact sont supprimés une fois traités.'],
    ar: ['5. مدة الاحتفاظ', 'تُحفظ بيانات تعريف الطلب المدة اللازمة للتوصيل وخدمة ما بعد البيع ثم تُجهَّل. ولا تُحفظ سوى المعطيات المحاسبية الإلزامية طوال المدة القانونية. تُحذف رسائل الاتصال بعد معالجتها.'],
  },
  {
    fr: ['6. Vos droits', 'Conformément à la loi n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel, vous disposez d’un droit d’accès, de rectification et d’opposition, ainsi que d’un droit de suppression. Écrivez-nous via la page Contact ; nous répondons dans un délai raisonnable. Vous pouvez aussi saisir la CNDP (www.cndp.ma).'],
    ar: ['6. حقوقك', 'طبقًا للقانون رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، لك حق الولوج والتصحيح والتعرض، وكذا الحذف. راسلنا عبر صفحة اتصل بنا وسنجيب في أجل معقول. ويمكنك أيضًا اللجوء إلى اللجنة الوطنية CNDP (www.cndp.ma).'],
  },
  {
    fr: ['7. Sécurité', 'Connexion chiffrée (HTTPS), accès d’administration protégé (mots de passe hachés, session sécurisée, protection anti-fraude), journalisation des actions d’administration et limitation des tentatives abusives.'],
    ar: ['7. الأمان', 'اتصال مشفّر (HTTPS)، وصول إداري محمي (كلمات مرور مشفّرة، جلسة آمنة، حماية من الاحتيال)، تسجيل عمليات الإدارة وتحديد المحاولات المسيئة.'],
  },
  {
    fr: ['8. Cookies et stockage local', 'Le site n’utilise aucun cookie publicitaire ou de suivi. Votre navigateur conserve uniquement votre panier et votre langue (stockage local) afin de faciliter votre navigation. Un cookie de session sécurisé est utilisé exclusivement par l’espace d’administration.'],
    ar: ['8. ملفات الارتباط والتخزين المحلي', 'لا يستعمل الموقع أي ملفات ارتباط إشهارية أو تتبّعية. يحتفظ متصفحك فقط بسلتك ولغتك (تخزين محلي) لتسهيل التصفح. ملف ارتباط الجلسة الآمن مخصص حصريًا لفضاء الإدارة.'],
  },
  {
    fr: ['9. Déclaration CNDP', '[À compléter : numéro de récépissé de déclaration/autorisation CNDP du traitement.]'],
    ar: ['9. التصريح لدى CNDP', '[يُستكمل: رقم وصل التصريح/الإذن لدى اللجنة الوطنية CNDP.]'],
  },
];

const TERMS: Section[] = [
  {
    fr: ['1. Objet', 'Les présentes conditions régissent les ventes de produits de nutrition sportive et d’alimentation saine réalisées sur ce site par [Raison sociale], ICE [numéro].'],
    ar: ['1. الموضوع', 'تنظّم هذه الشروط عمليات بيع منتجات التغذية الرياضية والتغذية الصحية عبر هذا الموقع من طرف [الاسم التجاري]، ICE [الرقم].'],
  },
  {
    fr: ['2. Produits et prix', 'Les prix sont indiqués en dirhams marocains (DH), toutes taxes comprises. Les photos sont non contractuelles. Une offre est valable dans la limite des stocks disponibles. Le prix applicable est celui affiché au moment de la validation de la commande.'],
    ar: ['2. المنتجات والأسعار', 'الأسعار بالدرهم المغربي (د.م) شاملة للضرائب. الصور غير ملزمة. العروض سارية في حدود المخزون المتوفر. السعر المطبّق هو المعروض وقت تأكيد الطلب.'],
  },
  {
    fr: ['3. Commande', 'La commande est enregistrée après validation du formulaire. Nous pouvons vous appeler pour la confirmer avant expédition. Nous nous réservons le droit d’annuler une commande en cas d’adresse injoignable, de stock indisponible ou d’abus manifeste.'],
    ar: ['3. الطلب', 'يُسجَّل الطلب بعد تأكيد النموذج. قد نتصل بك لتأكيده قبل الشحن. نحتفظ بحق إلغاء الطلب في حال تعذر الوصول إلى العنوان أو عدم توفر المخزون أو وجود إساءة واضحة.'],
  },
  {
    fr: ['4. Paiement', 'Le paiement s’effectue exclusivement en espèces à la livraison, au livreur, contre remise du colis. D’autres moyens de paiement pourront être proposés ultérieurement.'],
    ar: ['4. الأداء', 'يتم الأداء نقدًا عند الاستلام لعامل التوصيل مقابل تسليم الطرد فقط. قد تُقترح وسائل أداء أخرى لاحقًا.'],
  },
  {
    fr: ['5. Livraison', 'Livraison au Maroc. Les frais de livraison et le seuil de livraison gratuite sont indiqués dans le panier avant validation. Les délais sont communiqués à titre indicatif lors de la confirmation téléphonique.'],
    ar: ['5. التوصيل', 'التوصيل داخل المغرب. تظهر مصاريف التوصيل وحد التوصيل المجاني في السلة قبل التأكيد. الآجال إرشادية وتُبلَّغ عند التأكيد الهاتفي.'],
  },
  {
    fr: ['6. Retours', 'Pour des raisons d’hygiène et de sécurité alimentaire, les produits ouverts ne sont ni repris ni échangés. En cas de produit endommagé ou erroné, contactez-nous sous [48 h] avec votre numéro de commande.'],
    ar: ['6. الإرجاع', 'لأسباب النظافة وسلامة الأغذية، لا تُسترجع ولا تُبدَّل المنتجات المفتوحة. في حال منتج تالف أو خاطئ، تواصل معنا خلال [48 ساعة] مع رقم طلبك.'],
  },
  {
    fr: ['7. Santé', 'Les compléments alimentaires ne remplacent pas une alimentation variée et équilibrée. Ils ne sont pas destinés aux enfants, aux femmes enceintes ou allaitantes sans avis médical. Respectez les doses recommandées et demandez conseil à un professionnel de santé.'],
    ar: ['7. الصحة', 'المكملات الغذائية لا تعوّض نظامًا غذائيًا متنوعًا ومتوازنًا، وليست موجهة للأطفال أو الحوامل أو المرضعات دون استشارة طبية. احترم الجرعات الموصى بها واستشر مختصًا في الصحة.'],
  },
  {
    fr: ['8. Données personnelles', 'Voir notre Politique de confidentialité.'],
    ar: ['8. المعطيات الشخصية', 'راجع سياسة الخصوصية.'],
  },
  {
    fr: ['9. Droit applicable', 'Les présentes conditions sont soumises au droit marocain. Tout litige relève des tribunaux compétents de [ville].'],
    ar: ['9. القانون المطبّق', 'تخضع هذه الشروط للقانون المغربي. ويرجع أي نزاع إلى المحاكم المختصة بـ [المدينة].'],
  },
];

@Component({
  selector: 'app-legal',
  imports: [RouterLink, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="head">
      <div class="container">
        <span class="eyebrow">{{ 'footer.legal' | t }}</span>
        <h1>{{ doc() === 'privacy' ? ('footer.privacy' | t) : ('footer.terms' | t) }}</h1>
        <p class="muted">{{ 'legal.updated' | t }}</p>
      </div>
    </section>
    <article class="container doc">
      @for (s of sections(); track s[0]) {
        <h2>{{ s[0] }}</h2>
        <p>{{ s[1] }}</p>
      }
      <p class="links">
        <a routerLink="/contact" class="btn btn-ghost btn-sm">{{ 'nav.contact' | t }}</a>
      </p>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      background: var(--grad-soft);
      border-bottom: 1px solid var(--line);
      padding-block: 2.5rem;
    }
    h1 {
      font-size: clamp(1.9rem, 4vw, 2.8rem);
    }
    .doc {
      max-width: 820px;
      padding-block: 2.5rem 3rem;
    }
    h2 {
      font-size: 1.25rem;
      margin: 2rem 0 0.6rem;
    }
    p {
      color: #41564a;
    }
    .links {
      margin-top: 2.5rem;
    }
  `,
})
export class LegalPage {
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);
  protected settings = inject(SiteSettingsService).settings;
  protected doc = computed<'privacy' | 'terms'>(() => (this.route.snapshot.data['doc'] === 'terms' ? 'terms' : 'privacy'));
  protected sections = computed(() => {
    const lang = this.i18n.lang();
    return (this.doc() === 'privacy' ? PRIVACY : TERMS).map((s) => s[lang]);
  });
}
