-- Replace the earlier concept-only listings with the actual photos supplied by the owner.
delete from public.products
 where status = 'draft'
   and image_url in (
     '/assets/draft-concepts/adidas-style-track-jacket.svg',
     '/assets/draft-concepts/nike-style-sports-tee.svg',
     '/assets/draft-concepts/champion-style-crewneck.svg',
     '/assets/draft-concepts/north-face-style-shell-jacket.svg',
     '/assets/draft-concepts/bape-style-camo-hoodie.svg'
   );

-- Suggested sizes, conditions, stock, and prices are randomized estimates.
-- Keep these listings as drafts until the owner verifies the actual items and details.
insert into public.products
  (name, category, size, condition, stock, price, status, description, image_url)
select v.name, v.category, v.size, v.condition, v.stock, v.price, 'draft', v.description, v.image_url
from (values
  (
    'BAPE-Style Olive Camouflage Ape Graphic Hoodie',
    'Hoodies',
    'XL',
    'Good',
    1,
    1850,
    'Olive camouflage pullover hoodie with an ape-style chest graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-01.png'
  ),
  (
    'BAPE x Undefeated-Style Black and Cream Varsity Jacket',
    'Jackets',
    'M',
    'Very Good',
    1,
    3200,
    'Black and cream varsity-style jacket with visible BAPE- and Undefeated-style graphics. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-02.png'
  ),
  (
    'BAPE-Style Black Ape Graphic T-Shirt',
    'Shirts',
    'L',
    'Excellent',
    2,
    1100,
    'Black short-sleeve tee with a prominent ape-style graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-03.png'
  ),
  (
    'BAPE-Style Black Shark Hoodie with Red Camo Hood',
    'Hoodies',
    'XL',
    'Good',
    1,
    2700,
    'Black zip hoodie with a shark-face hood and red camouflage detail. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-04.png'
  ),
  (
    'BAPE-Style Full Camouflage Shark Hoodie',
    'Hoodies',
    'L',
    'Very Good',
    1,
    2900,
    'Full camouflage zip hoodie with a shark-face hood. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-05.png'
  ),
  (
    'White Graphic Streetwear Hoodie (Logo Unverified)',
    'Hoodies',
    'M',
    'Good',
    2,
    900,
    'White pullover hoodie with a small circular chest graphic. Brand and logo are not clearly verified from the photo. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-06.png'
  ),
  (
    'Stussy-Style Navy Script Logo T-Shirt',
    'Shirts',
    'M',
    'Very Good',
    2,
    850,
    'Navy short-sleeve tee with a small script-style chest logo. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-07.png'
  ),
  (
    'Stussy-Style White Increase the Peace Dragon T-Shirt',
    'Shirts',
    'L',
    'Good',
    1,
    980,
    'White graphic tee with a dragon illustration and Increase the Peace text. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-08.png'
  ),
  (
    'Stussy-Style Grey New York Graphic Hoodie',
    'Hoodies',
    'XL',
    'Good',
    1,
    1750,
    'Grey hoodie with a large New York back graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-09.png'
  ),
  (
    'Stussy-Style Black New York Graphic Hoodie',
    'Hoodies',
    'L',
    'Very Good',
    1,
    1800,
    'Black hoodie with a large New York back graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-10.png'
  ),
  (
    'Chrome Hearts-Style Black Praying Hands Graphic T-Shirt',
    'Shirts',
    'L',
    'Good',
    1,
    1250,
    'Black tee with a large praying-hands style graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-11.png'
  ),
  (
    'Chrome Hearts-Style Graphic Tank Top',
    'Tops',
    'M',
    'Good',
    1,
    950,
    'Graphic tank top shown with black and white design details. Brand attribution and authenticity are unverified; confirm the exact color and item shown before publishing. Size, condition, stock, and PHP price are provisional randomized suggestions.',
    '/assets/products/user-submitted-12.png'
  ),
  (
    'Chrome Hearts-Style Black Graphic Hoodie',
    'Hoodies',
    'XL',
    'Very Good',
    1,
    2400,
    'Black hoodie with large white gothic-style lettering and graphics. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-13.png'
  ),
  (
    'Chrome Hearts-Style Navy Cross Graphic Hoodie',
    'Hoodies',
    'M',
    'Good',
    1,
    2100,
    'Navy hooded top with a red horseshoe-style back graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-14.png'
  ),
  (
    'Chrome Hearts-Style Black Trucker Cap',
    'Hats',
    'One Size',
    'Good',
    1,
    900,
    'Black mesh-back cap with gothic-style lettering and cross graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-15.png'
  ),
  (
    'Chrome Hearts-Style Black Beanie',
    'Hats',
    'One Size',
    'Very Good',
    1,
    800,
    'Black knit beanie with a small gothic-style patch. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-16.png'
  ),
  (
    'Champion-Style White We Are the Champions T-Shirt',
    'Shirts',
    'L',
    'Very Good',
    2,
    700,
    'White short-sleeve tee with We Are the Champions lettering and a graphic print. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-17.png'
  ),
  (
    'Champion-Style Logo Fleece Sweatpants',
    'Sweatpants',
    'L',
    'Good',
    1,
    950,
    'The photo shows Champion-style sweatpants in multiple colorways. Brand attribution and authenticity are unverified; confirm which color and how many pieces are available before publishing. Size, condition, stock, and PHP price are provisional randomized suggestions.',
    '/assets/products/user-submitted-18.png'
  ),
  (
    'Champion-Style White Script Logo T-Shirt',
    'Shirts',
    'M',
    'Very Good',
    2,
    650,
    'White tee with a small script-style chest logo. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-19.png'
  ),
  (
    'Red New York Logo Baseball Cap',
    'Hats',
    'One Size',
    'Good',
    2,
    550,
    'Red baseball cap with a New York-style logo. Brand affiliation and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-20.png'
  ),
  (
    'Blue New York Logo Athletic Shorts',
    'Shorts',
    'M',
    'Very Good',
    1,
    650,
    'Blue athletic shorts with a New York-style logo. Brand affiliation and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-21.png'
  ),
  (
    'White MLB Life New York Graphic T-Shirt',
    'Shirts',
    'XL',
    'Good',
    1,
    750,
    'White tee with MLB Life and New York-themed graphics. Brand affiliation and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-22.png'
  ),
  (
    'Cream and Black New York Baseball Cap',
    'Hats',
    'One Size',
    'Excellent',
    1,
    600,
    'Cream and black baseball cap with a New York-style logo. Brand affiliation and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-23.png'
  ),
  (
    'Essentials-Style Taupe Pullover Hoodie',
    'Hoodies',
    'L',
    'Good',
    1,
    2200,
    'Taupe pullover hoodie with Essentials-style branding. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-24.png'
  ),
  (
    'Essentials-Style Black Zip Jacket',
    'Jackets',
    'XL',
    'Very Good',
    1,
    2600,
    'Black zip-front jacket with Essentials-style branding. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-25.png'
  ),
  (
    'Stussy-Style Black Logo Shorts',
    'Shorts',
    'L',
    'Very Good',
    2,
    800,
    'Black shorts with a small script-style logo. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-26.png'
  ),
  (
    'Nike-Style Black Tee and White Shorts Set',
    'Sets',
    'L',
    'Good',
    1,
    1300,
    'Photo shows a black tee and white shorts together. This draft treats them as one set; confirm both pieces are included and available together before publishing. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions.',
    '/assets/products/user-submitted-27.png'
  ),
  (
    'Nike-Style Black Graphic T-Shirt',
    'Shirts',
    'M',
    'Very Good',
    2,
    750,
    'Black short-sleeve tee with a sportswear-style chest graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-28.png'
  ),
  (
    'Nike-Style Black Athletic Shorts',
    'Shorts',
    'L',
    'Good',
    2,
    600,
    'Black athletic shorts with a small sportswear-style logo. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-29.png'
  ),
  (
    'Nike-Style Black Sleeveless Graphic Top',
    'Tops',
    'M',
    'Very Good',
    1,
    700,
    'Black sleeveless sportswear top with a chest graphic. Brand attribution and authenticity are unverified. Size, condition, stock, and PHP price are provisional randomized suggestions; confirm before publishing.',
    '/assets/products/user-submitted-30.png'
  )
) as v(name, category, size, condition, stock, price, description, image_url)
where not exists (
  select 1
    from public.products p
   where p.image_url = v.image_url
);
