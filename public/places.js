/* Meeqat — location hierarchy: Country → Region / State → City / Town → Area / Locality.
 * Built-in list works offline. "Search any place" and "Use my location" use OpenStreetMap (online).
 * Each country/region carries the time zone, calculation method and Asr madhab used by default. */
(function (g) {
  'use strict';
  /* ---------------------------------------------------------------- data
   * country: [name, tz, method, madhab, defaultRegion, regions]
   * region : [name, cities, overrides {tz, method, madhab}]
   * city   : [name, lat, lng, group]   (group = district, shown as a heading) */
  const D = {};
  const C = (code, name, tz, method, madhab, def, regions) => { D[code] = { code, name, tz, method, madhab, def, regions }; };
  const R = (name, cities, o) => Object.assign({ name, cities }, o || {});

  /* ---------- India ---------- */
  const KL = (d, list) => list.map((c) => [c[0], c[1], c[2], d]);
  C('IN', 'India', 'Asia/Kolkata', 'Karachi', 'hanafi', 'Kerala', [
    R('Kerala', [].concat(
      KL('Kasaragod', [['Kasaragod', 12.4996, 74.9869], ['Kanhangad', 12.3150, 75.0900], ['Nileshwaram', 12.2560, 75.1350], ['Trikaripur', 12.1380, 75.1780], ['Uppala', 12.6820, 74.9070], ['Manjeshwaram', 12.7200, 74.8900]]),
      KL('Kannur', [['Kannur', 11.8745, 75.3704], ['Thalassery', 11.7480, 75.4890], ['Taliparamba', 12.0380, 75.3600], ['Payyanur', 12.1000, 75.2000], ['Mattannur', 11.9300, 75.5700], ['Iritty', 11.9800, 75.6700], ['Koothuparamba', 11.8300, 75.5700], ['Panoor', 11.7600, 75.5800]]),
      KL('Wayanad', [['Kalpetta', 11.6085, 76.0830], ['Sulthan Bathery', 11.6633, 76.2569], ['Mananthavady', 11.8014, 76.0044], ['Meppadi', 11.5560, 76.1320]]),
      KL('Kozhikode', [['Kozhikode', 11.2588, 75.7804], ['Vadakara', 11.6080, 75.5917], ['Koyilandy', 11.4380, 75.6950], ['Feroke', 11.1800, 75.8400], ['Ramanattukara', 11.1700, 75.8700], ['Mukkam', 11.3220, 75.9950], ['Thamarassery', 11.4150, 75.9380], ['Kunnamangalam', 11.3040, 75.8770], ['Perambra', 11.5600, 75.7600], ['Balussery', 11.4430, 75.8290], ['Nadapuram', 11.6800, 75.6500], ['Kuttiady', 11.6540, 75.7570], ['Payyoli', 11.5260, 75.6600], ['Koduvally', 11.3600, 75.9100]]),
      KL('Malappuram', [['Malappuram', 11.0510, 76.0711], ['Manjeri', 11.1203, 76.1200], ['Perinthalmanna', 10.9760, 76.2250], ['Tirur', 10.9150, 75.9230], ['Kottakkal', 10.9990, 76.0000], ['Ponnani', 10.7700, 75.9250], ['Nilambur', 11.2760, 76.2250], ['Tanur', 10.9700, 75.8700], ['Kondotty', 11.1480, 75.9620], ['Valanchery', 10.8890, 76.0730], ['Tirurangadi', 11.0400, 75.9300], ['Parappanangadi', 11.0470, 75.8600], ['Areekode', 11.2350, 76.0510], ['Edappal', 10.7880, 76.0060], ['Wandoor', 11.1970, 76.2300]]),
      KL('Palakkad', [['Palakkad', 10.7867, 76.6548], ['Ottapalam', 10.7700, 76.3770], ['Mannarkkad', 10.9930, 76.4610], ['Pattambi', 10.8070, 76.1960], ['Shornur', 10.7600, 76.2700], ['Chittur', 10.6990, 76.7470], ['Cherpulassery', 10.8800, 76.3100]]),
      KL('Thrissur', [['Thrissur', 10.5276, 76.2144], ['Kodungallur', 10.2251, 76.1980], ['Chavakkad', 10.5833, 76.0167], ['Guruvayur', 10.5946, 76.0369], ['Kunnamkulam', 10.6500, 76.0700], ['Irinjalakuda', 10.3420, 76.2110], ['Chalakudy', 10.3070, 76.3340], ['Wadakkanchery', 10.6600, 76.2500]]),
      KL('Ernakulam', [['Kochi', 9.9312, 76.2673], ['Aluva', 10.1076, 76.3516], ['Perumbavoor', 10.1155, 76.4769], ['Muvattupuzha', 9.9894, 76.5790], ['Kothamangalam', 10.0602, 76.6351], ['Angamaly', 10.1960, 76.3860], ['Kakkanad', 10.0159, 76.3419], ['Mattancherry', 9.9580, 76.2590], ['North Paravur', 10.1440, 76.2290]]),
      KL('Idukki', [['Thodupuzha', 9.8939, 76.7158], ['Kattappana', 9.7489, 77.1148], ['Munnar', 10.0889, 77.0595], ['Nedumkandam', 9.8400, 77.1570]]),
      KL('Kottayam', [['Kottayam', 9.5916, 76.5222], ['Changanassery', 9.4442, 76.5409], ['Erattupetta', 9.6875, 76.7783], ['Pala', 9.7086, 76.6848], ['Kanjirappally', 9.5557, 76.7891], ['Vaikom', 9.7500, 76.3930]]),
      KL('Alappuzha', [['Alappuzha', 9.4981, 76.3388], ['Kayamkulam', 9.1748, 76.5013], ['Cherthala', 9.6840, 76.3363], ['Haripad', 9.2833, 76.4500], ['Mavelikkara', 9.2500, 76.5500], ['Chengannur', 9.3180, 76.6110]]),
      KL('Pathanamthitta', [['Pathanamthitta', 9.2648, 76.7870], ['Thiruvalla', 9.3835, 76.5741], ['Adoor', 9.1530, 76.7356]]),
      KL('Kollam', [['Kollam', 8.8932, 76.6141], ['Karunagappally', 9.0596, 76.5355], ['Punalur', 9.0172, 76.9264], ['Kottarakkara', 9.0006, 76.7719], ['Chathannoor', 8.8580, 76.7230]]),
      KL('Thiruvananthapuram', [['Thiruvananthapuram', 8.5241, 76.9366], ['Neyyattinkara', 8.4004, 77.0855], ['Attingal', 8.6966, 76.8150], ['Varkala', 8.7379, 76.7163], ['Nedumangad', 8.6034, 77.0011]])
    ), { madhab: 'shafi', def: 'Kozhikode' }),
    R('Andaman & Nicobar', [['Port Blair', 11.6234, 92.7265]]),
    R('Andhra Pradesh', [['Vijayawada', 16.5062, 80.6480], ['Visakhapatnam', 17.6868, 83.2185], ['Kurnool', 15.8281, 78.0373], ['Guntur', 16.3067, 80.4365], ['Kadapa', 14.4673, 78.8242], ['Nellore', 14.4426, 79.9865]]),
    R('Assam', [['Guwahati', 26.1445, 91.7362], ['Dhubri', 26.0200, 89.9800], ['Silchar', 24.8333, 92.7789], ['Barpeta', 26.3200, 91.0000]]),
    R('Bihar', [['Patna', 25.5941, 85.1376], ['Gaya', 24.7955, 85.0002], ['Kishanganj', 26.1000, 87.9500], ['Darbhanga', 26.1542, 85.8918], ['Purnia', 25.7771, 87.4753]]),
    R('Chandigarh', [['Chandigarh', 30.7333, 76.7794]]),
    R('Chhattisgarh', [['Raipur', 21.2514, 81.6296], ['Bilaspur', 22.0797, 82.1409]]),
    R('Delhi', [['New Delhi', 28.6139, 77.2090], ['Old Delhi', 28.6562, 77.2410]]),
    R('Goa', [['Panaji', 15.4909, 73.8278], ['Margao', 15.2832, 73.9862]]),
    R('Gujarat', [['Ahmedabad', 23.0225, 72.5714], ['Surat', 21.1702, 72.8311], ['Vadodara', 22.3072, 73.1812], ['Rajkot', 22.3039, 70.8022], ['Bharuch', 21.7051, 72.9959], ['Godhra', 22.7788, 73.6143]]),
    R('Haryana', [['Gurugram', 28.4595, 77.0266], ['Faridabad', 28.4089, 77.3178], ['Nuh', 28.1000, 77.0000]]),
    R('Himachal Pradesh', [['Shimla', 31.1048, 77.1734]]),
    R('Jammu & Kashmir', [['Srinagar', 34.0837, 74.7973], ['Jammu', 32.7266, 74.8570], ['Anantnag', 33.7311, 75.1487], ['Baramulla', 34.2095, 74.3436], ['Sopore', 34.3000, 74.4700]]),
    R('Jharkhand', [['Ranchi', 23.3441, 85.3096], ['Jamshedpur', 22.8046, 86.2029], ['Dhanbad', 23.7957, 86.4304]]),
    R('Karnataka', [['Bengaluru', 12.9716, 77.5946], ['Mangaluru', 12.9141, 74.8560], ['Mysuru', 12.2958, 76.6394], ['Hubballi', 15.3647, 75.1240], ['Bhatkal', 13.9850, 74.5550], ['Udupi', 13.3409, 74.7421], ['Belagavi', 15.8497, 74.4977], ['Kalaburagi', 17.3297, 76.8343], ['Bidar', 17.9104, 77.5199], ['Puttur', 12.7600, 75.2000]]),
    R('Ladakh', [['Leh', 34.1526, 77.5771], ['Kargil', 34.5539, 76.1349]]),
    R('Lakshadweep', [['Kavaratti', 10.5626, 72.6369], ['Agatti', 10.8500, 72.1900], ['Andrott', 10.8167, 73.6833]], { madhab: 'shafi' }),
    R('Madhya Pradesh', [['Bhopal', 23.2599, 77.4126], ['Indore', 22.7196, 75.8577], ['Burhanpur', 21.3090, 76.2300]]),
    R('Maharashtra', [['Mumbai', 19.0760, 72.8777], ['Pune', 18.5204, 73.8567], ['Nagpur', 21.1458, 79.0882], ['Aurangabad', 19.8762, 75.3433], ['Nashik', 19.9975, 73.7898], ['Malegaon', 20.5537, 74.5288], ['Bhiwandi', 19.2813, 73.0483], ['Thane', 19.2183, 72.9781]]),
    R('Manipur', [['Imphal', 24.8170, 93.9368]]),
    R('Meghalaya', [['Shillong', 25.5788, 91.8933]]),
    R('Odisha', [['Bhubaneswar', 20.2961, 85.8245], ['Cuttack', 20.4625, 85.8830]]),
    R('Puducherry', [['Puducherry', 11.9416, 79.8083], ['Mahe', 11.7008, 75.5363], ['Karaikal', 10.9254, 79.8380]]),
    R('Punjab', [['Ludhiana', 30.9010, 75.8573], ['Amritsar', 31.6340, 74.8723], ['Malerkotla', 30.5300, 75.8800]]),
    R('Rajasthan', [['Jaipur', 26.9124, 75.7873], ['Jodhpur', 26.2389, 73.0243], ['Ajmer', 26.4499, 74.6399], ['Tonk', 26.1664, 75.7885], ['Kota', 25.2138, 75.8648]]),
    R('Tamil Nadu', [['Chennai', 13.0827, 80.2707], ['Coimbatore', 11.0168, 76.9558], ['Madurai', 9.9252, 78.1198], ['Tiruchirappalli', 10.7905, 78.7047], ['Tirunelveli', 8.7139, 77.7567], ['Vellore', 12.9165, 79.1325], ['Ambur', 12.7904, 78.7166], ['Vaniyambadi', 12.6820, 78.6200], ['Salem', 11.6643, 78.1460], ['Nagercoil', 8.1833, 77.4119], ['Kayalpatnam', 8.5700, 78.1200], ['Keelakarai', 9.2300, 78.7800], ['Nagapattinam', 10.7672, 79.8449]]),
    R('Telangana', [['Hyderabad', 17.3850, 78.4867], ['Warangal', 17.9689, 79.5941], ['Nizamabad', 18.6725, 78.0941]]),
    R('Tripura', [['Agartala', 23.8315, 91.2868]]),
    R('Uttar Pradesh', [['Lucknow', 26.8467, 80.9462], ['Kanpur', 26.4499, 80.3319], ['Aligarh', 27.8974, 78.0880], ['Moradabad', 28.8386, 78.7733], ['Bareilly', 28.3670, 79.4304], ['Saharanpur', 29.9680, 77.5552], ['Deoband', 29.6930, 77.6800], ['Agra', 27.1767, 78.0081], ['Varanasi', 25.3176, 82.9739], ['Meerut', 28.9845, 77.7064], ['Prayagraj', 25.4358, 81.8463], ['Rampur', 28.8070, 79.0250]]),
    R('Uttarakhand', [['Dehradun', 30.3165, 78.0322], ['Haridwar', 29.9457, 78.1642]]),
    R('West Bengal', [['Kolkata', 22.5726, 88.3639], ['Howrah', 22.5958, 88.2636], ['Murshidabad', 24.1800, 88.2700], ['Siliguri', 26.7271, 88.3953], ['Malda', 25.0108, 88.1411]])
  ]);

  /* ---------- Gulf ---------- */
  C('AE', 'United Arab Emirates', 'Asia/Dubai', 'Dubai', 'shafi', 'Sharjah', [
    R('Abu Dhabi', [['Abu Dhabi', 24.4539, 54.3773], ['Al Ain', 24.2075, 55.7447], ['Madinat Zayed', 23.6800, 53.7000], ['Ruwais', 24.1100, 52.7300], ['Mussafah', 24.3500, 54.5000]]),
    R('Ajman', [['Ajman', 25.4052, 55.5136], ['Masfout', 24.8200, 56.1000]]),
    R('Dubai', [['Dubai', 25.2048, 55.2708], ['Hatta', 24.7969, 56.1167]]),
    R('Fujairah', [['Fujairah', 25.1288, 56.3265], ['Dibba Al Fujairah', 25.5900, 56.2600]]),
    R('Ras Al Khaimah', [['Ras Al Khaimah', 25.8007, 55.9762]]),
    R('Sharjah', [['Sharjah', 25.3463, 55.4209], ['Khor Fakkan', 25.3393, 56.3426], ['Kalba', 25.0500, 56.3500], ['Dibba Al Hisn', 25.6196, 56.2729], ['Al Dhaid', 25.2881, 55.8817]]),
    R('Umm Al Quwain', [['Umm Al Quwain', 25.5647, 55.5552]])
  ]);
  C('SA', 'Saudi Arabia', 'Asia/Riyadh', 'UmmAlQura', 'shafi', 'Makkah', [
    R('Asir', [['Abha', 18.2164, 42.5053], ['Khamis Mushait', 18.3000, 42.7333]]),
    R('Eastern Province', [['Dammam', 26.4207, 50.0888], ['Al Khobar', 26.2172, 50.1971], ['Jubail', 27.0046, 49.6460], ['Al Ahsa (Hofuf)', 25.3833, 49.5833]]),
    R('Hail', [['Hail', 27.5114, 41.7208]]),
    R('Jazan', [['Jazan', 16.8892, 42.5511]]),
    R('Madinah', [['Madinah', 24.4672, 39.6111], ['Yanbu', 24.0890, 38.0618]]),
    R('Makkah', [['Makkah', 21.4225, 39.8262], ['Jeddah', 21.4858, 39.1925], ['Taif', 21.2703, 40.4158]]),
    R('Najran', [['Najran', 17.4924, 44.1277]]),
    R('Qassim', [['Buraidah', 26.3260, 43.9750], ['Unaizah', 26.0840, 43.9940]]),
    R('Riyadh', [['Riyadh', 24.7136, 46.6753], ['Al Kharj', 24.1500, 47.3000]]),
    R('Tabuk', [['Tabuk', 28.3835, 36.5662]])
  ]);
  C('QA', 'Qatar', 'Asia/Qatar', 'Qatar', 'shafi', 'Doha', [
    R('Doha', [['Doha', 25.2854, 51.5310]]), R('Al Rayyan', [['Al Rayyan', 25.2919, 51.4244]]),
    R('Al Wakrah', [['Al Wakrah', 25.1659, 51.6038]]), R('Al Khor', [['Al Khor', 25.6839, 51.4969]])
  ]);
  C('OM', 'Oman', 'Asia/Muscat', 'MuslimWorldLeague', 'shafi', 'Muscat', [
    R('Muscat', [['Muscat', 23.5880, 58.3829], ['Seeb', 23.6703, 58.1890], ['Ruwi', 23.5990, 58.5450]]),
    R('Dhofar', [['Salalah', 17.0151, 54.0924]]),
    R('Al Batinah North', [['Sohar', 24.3470, 56.7090]]),
    R('Ad Dakhiliyah', [['Nizwa', 22.9333, 57.5333]]),
    R('Ash Sharqiyah', [['Sur', 22.5667, 59.5289], ['Ibra', 22.6900, 58.5300]])
  ]);
  C('KW', 'Kuwait', 'Asia/Kuwait', 'Kuwait', 'shafi', 'Capital', [
    R('Capital', [['Kuwait City', 29.3759, 47.9774]]), R('Hawalli', [['Hawalli', 29.3328, 48.0286], ['Salmiya', 29.3340, 48.0760]]),
    R('Farwaniya', [['Farwaniya', 29.2775, 47.9586]]), R('Ahmadi', [['Ahmadi', 29.0769, 48.0838], ['Fahaheel', 29.0825, 48.1303]]),
    R('Jahra', [['Jahra', 29.3375, 47.6581]])
  ]);
  C('BH', 'Bahrain', 'Asia/Bahrain', 'UmmAlQura', 'shafi', 'Capital', [
    R('Capital', [['Manama', 26.2285, 50.5860]]), R('Muharraq', [['Muharraq', 26.2572, 50.6119]]),
    R('Southern', [['Riffa', 26.1300, 50.5550]]), R('Northern', [['Hamad Town', 26.1150, 50.4970]])
  ]);

  /* ---------- South Asia ---------- */
  C('PK', 'Pakistan', 'Asia/Karachi', 'Karachi', 'hanafi', 'Sindh', [
    R('Balochistan', [['Quetta', 30.1798, 66.9750], ['Gwadar', 25.1264, 62.3225]]),
    R('Islamabad', [['Islamabad', 33.6844, 73.0479]]),
    R('Khyber Pakhtunkhwa', [['Peshawar', 34.0151, 71.5249], ['Mardan', 34.1986, 72.0404], ['Abbottabad', 34.1688, 73.2215]]),
    R('Punjab', [['Lahore', 31.5204, 74.3587], ['Faisalabad', 31.4504, 73.1350], ['Rawalpindi', 33.5651, 73.0169], ['Multan', 30.1575, 71.5249], ['Gujranwala', 32.1877, 74.1945], ['Sialkot', 32.4945, 74.5229]]),
    R('Sindh', [['Karachi', 24.8607, 67.0011], ['Hyderabad', 25.3960, 68.3578], ['Sukkur', 27.7052, 68.8574]])
  ]);
  C('BD', 'Bangladesh', 'Asia/Dhaka', 'Karachi', 'hanafi', 'Dhaka', [
    R('Barishal', [['Barishal', 22.7010, 90.3535]]),
    R('Chattogram', [['Chattogram', 22.3569, 91.7832], ["Cox's Bazar", 21.4272, 92.0058], ['Cumilla', 23.4607, 91.1809]]),
    R('Dhaka', [['Dhaka', 23.8103, 90.4125], ['Narayanganj', 23.6238, 90.5000], ['Gazipur', 23.9999, 90.4203]]),
    R('Khulna', [['Khulna', 22.8456, 89.5403]]), R('Mymensingh', [['Mymensingh', 24.7471, 90.4203]]),
    R('Rajshahi', [['Rajshahi', 24.3745, 88.6042]]), R('Rangpur', [['Rangpur', 25.7439, 89.2752]]), R('Sylhet', [['Sylhet', 24.8949, 91.8687]])
  ]);
  C('LK', 'Sri Lanka', 'Asia/Colombo', 'Karachi', 'shafi', 'Western', [
    R('Central', [['Kandy', 7.2906, 80.6337]]),
    R('Eastern', [['Batticaloa', 7.7310, 81.6747], ['Kattankudy', 7.6750, 81.7300], ['Kalmunai', 7.4167, 81.8167], ['Trincomalee', 8.5874, 81.2152]]),
    R('North Western', [['Puttalam', 8.0362, 79.8283], ['Kurunegala', 7.4863, 80.3647]]),
    R('Northern', [['Jaffna', 9.6615, 80.0255]]), R('Southern', [['Galle', 6.0535, 80.2210]]),
    R('Western', [['Colombo', 6.9271, 79.8612], ['Negombo', 7.2008, 79.8737], ['Kalutara', 6.5854, 79.9607], ['Beruwala', 6.4788, 79.9828]])
  ]);
  C('MV', 'Maldives', 'Indian/Maldives', 'MuslimWorldLeague', 'shafi', 'Malé', [
    R('Malé', [['Malé', 4.1755, 73.5093], ['Hulhumalé', 4.2105, 73.5402]]), R('Addu', [['Addu City', -0.6300, 73.1600]])
  ]);

  /* ---------- South-East Asia ---------- */
  C('MY', 'Malaysia', 'Asia/Kuala_Lumpur', 'Singapore', 'shafi', 'Kuala Lumpur', [
    R('Johor', [['Johor Bahru', 1.4927, 103.7414]]), R('Kelantan', [['Kota Bharu', 6.1254, 102.2381]]),
    R('Kuala Lumpur', [['Kuala Lumpur', 3.1390, 101.6869]]), R('Penang', [['George Town', 5.4141, 100.3288]]),
    R('Sabah', [['Kota Kinabalu', 5.9804, 116.0735]]), R('Sarawak', [['Kuching', 1.5535, 110.3593]]),
    R('Selangor', [['Shah Alam', 3.0733, 101.5185], ['Petaling Jaya', 3.1073, 101.6067], ['Klang', 3.0449, 101.4456]])
  ]);
  C('ID', 'Indonesia', 'Asia/Jakarta', 'Singapore', 'shafi', 'Jakarta', [
    R('Aceh', [['Banda Aceh', 5.5483, 95.3238]]), R('Bali', [['Denpasar', -8.6705, 115.2126]], { tz: 'Asia/Makassar' }),
    R('Central Java', [['Semarang', -6.9667, 110.4167]]), R('East Java', [['Surabaya', -7.2575, 112.7521], ['Malang', -7.9666, 112.6326]]),
    R('Jakarta', [['Jakarta', -6.2088, 106.8456]]), R('North Sumatra', [['Medan', 3.5952, 98.6722]]),
    R('South Sulawesi', [['Makassar', -5.1477, 119.4327]], { tz: 'Asia/Makassar' }),
    R('West Java', [['Bandung', -6.9175, 107.6191], ['Bogor', -6.5971, 106.8060]]), R('Yogyakarta', [['Yogyakarta', -7.7956, 110.3695]])
  ]);
  C('SG', 'Singapore', 'Asia/Singapore', 'Singapore', 'shafi', 'Singapore', [R('Singapore', [['Singapore', 1.3521, 103.8198]])]);

  /* ---------- Middle East / Africa ---------- */
  C('TR', 'Türkiye', 'Europe/Istanbul', 'Turkey', 'hanafi', 'Istanbul', [
    R('Ankara', [['Ankara', 39.9334, 32.8597]]), R('Bursa', [['Bursa', 40.1885, 29.0610]]), R('Istanbul', [['Istanbul', 41.0082, 28.9784]]),
    R('Izmir', [['Izmir', 38.4237, 27.1428]]), R('Konya', [['Konya', 37.8746, 32.4932]])
  ]);
  C('EG', 'Egypt', 'Africa/Cairo', 'Egyptian', 'shafi', 'Cairo', [
    R('Alexandria', [['Alexandria', 31.2001, 29.9187]]), R('Aswan', [['Aswan', 24.0889, 32.8998]]), R('Cairo', [['Cairo', 30.0444, 31.2357]]),
    R('Giza', [['Giza', 30.0131, 31.2089]]), R('Luxor', [['Luxor', 25.6872, 32.6396]])
  ]);
  C('JO', 'Jordan', 'Asia/Amman', 'MuslimWorldLeague', 'shafi', 'Amman', [R('Amman', [['Amman', 31.9454, 35.9284]]), R('Irbid', [['Irbid', 32.5568, 35.8469]]), R('Zarqa', [['Zarqa', 32.0728, 36.0880]])]);
  C('ZM', 'Zambia', 'Africa/Lusaka', 'MuslimWorldLeague', 'shafi', 'Lusaka', [
    R('Central', [['Kabwe', -14.4469, 28.4464]]), R('Copperbelt', [['Ndola', -12.9587, 28.6366], ['Kitwe', -12.8024, 28.2132]]),
    R('Eastern', [['Chipata', -13.6333, 32.6500]]), R('Lusaka', [['Lusaka', -15.3875, 28.3228]]), R('Southern', [['Livingstone', -17.8419, 25.8543]])
  ]);
  C('KE', 'Kenya', 'Africa/Nairobi', 'MuslimWorldLeague', 'shafi', 'Nairobi', [
    R('Garissa', [['Garissa', -0.4532, 39.6461]]), R('Kisumu', [['Kisumu', -0.0917, 34.7680]]), R('Lamu', [['Lamu', -2.2717, 40.9020]]),
    R('Mombasa', [['Mombasa', -4.0435, 39.6682]]), R('Nairobi', [['Nairobi', -1.2921, 36.8219]])
  ]);
  C('ZA', 'South Africa', 'Africa/Johannesburg', 'MuslimWorldLeague', 'shafi', 'Gauteng', [
    R('Gauteng', [['Johannesburg', -26.2041, 28.0473], ['Pretoria', -25.7479, 28.2293]]), R('KwaZulu-Natal', [['Durban', -29.8587, 31.0218]]),
    R('Western Cape', [['Cape Town', -33.9249, 18.4241]])
  ]);
  C('NG', 'Nigeria', 'Africa/Lagos', 'MuslimWorldLeague', 'shafi', 'Lagos', [
    R('FCT Abuja', [['Abuja', 9.0765, 7.3986]]), R('Kaduna', [['Kaduna', 10.5105, 7.4165]]), R('Kano', [['Kano', 12.0022, 8.5920]]),
    R('Lagos', [['Lagos', 6.5244, 3.3792]]), R('Sokoto', [['Sokoto', 13.0059, 5.2476]])
  ]);

  /* ---------- Europe / Americas / Oceania ---------- */
  C('GB', 'United Kingdom', 'Europe/London', 'MoonsightingCommittee', 'shafi', 'England', [
    R('England', [['London', 51.5074, -0.1278], ['Birmingham', 52.4862, -1.8904], ['Manchester', 53.4808, -2.2426], ['Bradford', 53.7960, -1.7594], ['Leicester', 52.6369, -1.1398], ['Leeds', 53.8008, -1.5491], ['Sheffield', 53.3811, -1.4701], ['Luton', 51.8787, -0.4200], ['Blackburn', 53.7480, -2.4820]]),
    R('Northern Ireland', [['Belfast', 54.5973, -5.9301]]), R('Scotland', [['Glasgow', 55.8642, -4.2518], ['Edinburgh', 55.9533, -3.1883]]), R('Wales', [['Cardiff', 51.4816, -3.1791]])
  ]);
  C('IE', 'Ireland', 'Europe/Dublin', 'MuslimWorldLeague', 'shafi', 'Leinster', [R('Leinster', [['Dublin', 53.3498, -6.2603]]), R('Munster', [['Cork', 51.8985, -8.4756]])]);
  C('DE', 'Germany', 'Europe/Berlin', 'MuslimWorldLeague', 'shafi', 'Berlin', [
    R('Bavaria', [['Munich', 48.1351, 11.5820]]), R('Berlin', [['Berlin', 52.5200, 13.4050]]), R('Hamburg', [['Hamburg', 53.5511, 9.9937]]),
    R('Hesse', [['Frankfurt', 50.1109, 8.6821]]), R('North Rhine-Westphalia', [['Cologne', 50.9375, 6.9603], ['Duisburg', 51.4344, 6.7623]])
  ]);
  C('FR', 'France', 'Europe/Paris', 'MuslimWorldLeague', 'shafi', 'Île-de-France', [
    R('Auvergne-Rhône-Alpes', [['Lyon', 45.7640, 4.8357]]), R('Hauts-de-France', [['Lille', 50.6292, 3.0573]]),
    R('Île-de-France', [['Paris', 48.8566, 2.3522]]), R("Provence-Alpes-Côte d'Azur", [['Marseille', 43.2965, 5.3698]])
  ]);
  C('NL', 'Netherlands', 'Europe/Amsterdam', 'MuslimWorldLeague', 'shafi', 'North Holland', [
    R('North Holland', [['Amsterdam', 52.3676, 4.9041]]), R('South Holland', [['Rotterdam', 51.9244, 4.4777], ['The Hague', 52.0705, 4.3007], ['Maassluis', 51.9230, 4.2500]]),
    R('Utrecht', [['Utrecht', 52.0907, 5.1214]])
  ]);
  C('US', 'United States', 'America/New_York', 'NorthAmerica', 'shafi', 'New York', [
    R('Arizona', [['Phoenix', 33.4484, -112.0740]], { tz: 'America/Phoenix' }),
    R('California', [['Los Angeles', 34.0522, -118.2437], ['San Francisco', 37.7749, -122.4194], ['San Jose', 37.3382, -121.8863]], { tz: 'America/Los_Angeles' }),
    R('Florida', [['Miami', 25.7617, -80.1918], ['Orlando', 28.5383, -81.3792]]),
    R('Georgia', [['Atlanta', 33.7490, -84.3880]]),
    R('Illinois', [['Chicago', 41.8781, -87.6298]], { tz: 'America/Chicago' }),
    R('Michigan', [['Dearborn', 42.3223, -83.1763], ['Detroit', 42.3314, -83.0458]], { tz: 'America/Detroit' }),
    R('Minnesota', [['Minneapolis', 44.9778, -93.2650]], { tz: 'America/Chicago' }),
    R('New Jersey', [['Paterson', 40.9168, -74.1718], ['Jersey City', 40.7178, -74.0431]]),
    R('New York', [['New York City', 40.7128, -74.0060]]),
    R('Texas', [['Houston', 29.7604, -95.3698], ['Dallas', 32.7767, -96.7970]], { tz: 'America/Chicago' }),
    R('Virginia', [['Fairfax', 38.8462, -77.3064]]),
    R('Washington', [['Seattle', 47.6062, -122.3321]], { tz: 'America/Los_Angeles' })
  ]);
  C('CA', 'Canada', 'America/Toronto', 'NorthAmerica', 'shafi', 'Ontario', [
    R('Alberta', [['Calgary', 51.0447, -114.0719], ['Edmonton', 53.5461, -113.4938]], { tz: 'America/Edmonton' }),
    R('British Columbia', [['Vancouver', 49.2827, -123.1207]], { tz: 'America/Vancouver' }),
    R('Ontario', [['Toronto', 43.6532, -79.3832], ['Mississauga', 43.5890, -79.6441], ['Ottawa', 45.4215, -75.6972]]),
    R('Quebec', [['Montreal', 45.5017, -73.5673]])
  ]);
  C('AU', 'Australia', 'Australia/Sydney', 'MuslimWorldLeague', 'shafi', 'New South Wales', [
    R('New South Wales', [['Sydney', -33.8688, 151.2093]]), R('Queensland', [['Brisbane', -27.4698, 153.0251]], { tz: 'Australia/Brisbane' }),
    R('South Australia', [['Adelaide', -34.9285, 138.6007]], { tz: 'Australia/Adelaide' }), R('Victoria', [['Melbourne', -37.8136, 144.9631]], { tz: 'Australia/Melbourne' }),
    R('Western Australia', [['Perth', -31.9505, 115.8605]], { tz: 'Australia/Perth' })
  ]);

  /* Area / locality suggestions (free text is always allowed). */
  const AREAS = {
    'IN|Kerala|Kozhikode': ['Kuttichira', 'Palayam', 'Mavoor Road', 'Nadakkavu', 'West Hill', 'Chevayur', 'Medical College', 'Mankavu', 'Kallai', 'Beypore', 'Meenchanda', 'Eranhipalam', 'Pantheerankavu', 'Nallalam', 'Elathur', 'Kunduparamba', 'Puthiyangadi', 'Vellayil', 'Thiruvannur', 'Kovoor'],
    'IN|Kerala|Malappuram': ['Kottappadi', 'Down Hill', 'Up Hill', 'Munduparamba', 'Kunnummal', 'Kozhichena', 'Panakkad'],
    'IN|Kerala|Kochi': ['Ernakulam', 'Edappally', 'Kaloor', 'Fort Kochi', 'Palarivattom', 'Vyttila', 'Kadavanthra', 'Thoppumpady', 'Kalamassery'],
    'IN|Kerala|Kannur': ['Thana', 'City', 'Chovva', 'Thavakkara', 'Pallikkunnu', 'Puthiyatheru'],
    'IN|Kerala|Thiruvananthapuram': ['Palayam', 'Beemapally', 'Vallakadavu', 'Kazhakootam', 'Pettah', 'Manacaud', 'Peroorkada'],
    'AE|Sharjah|Sharjah': ['Al Nahda', 'Al Majaz', 'Al Qasimia', 'Al Taawun', 'Al Khan', 'Rolla', 'Muwaileh', 'Abu Shagara', 'Al Nabba', 'Al Gharb', 'Industrial Area', 'University City', 'Al Butina', 'Al Ghuwair'],
    'AE|Dubai|Dubai': ['Deira', 'Bur Dubai', 'Al Qusais', 'Karama', 'Al Nahda', 'Mirdif', 'JLT', 'Dubai Marina', 'Al Barsha', 'International City', 'Jumeirah', 'Al Quoz', 'Satwa', 'Muhaisnah', 'Al Muteena'],
    'AE|Abu Dhabi|Abu Dhabi': ['Al Khalidiya', 'Al Mushrif', 'Hamdan Street', 'Electra Street', 'Mussafah', 'Khalifa City', 'Al Reem Island', 'Al Wahda'],
    'AE|Ajman|Ajman': ['Al Nuaimiya', 'Al Rashidiya', 'Al Jurf', 'Al Rawda', 'Al Mowaihat'],
    'SA|Makkah|Jeddah': ['Al Balad', 'Al Rawdah', 'Al Safa', 'Al Aziziyah', 'Al Hamra', 'Al Sharafiyah'],
    'SA|Riyadh|Riyadh': ['Al Olaya', 'Al Malaz', 'Al Batha', 'Al Murabba', 'Al Naseem', 'Al Sulay']
  };

  /* ---------------------------------------------------------------- helpers */
  const P = { DATA: D, AREAS };
  const sortedCountries = () => Object.values(D).sort((a, b) => a.name.localeCompare(b.name));
  const priority = ['IN', 'AE', 'SA', 'QA', 'OM', 'KW', 'BH'];
  P.countries = () => priority.map((c) => D[c]).concat(sortedCountries().filter((c) => !priority.includes(c.code)));
  P.country = (cc) => D[cc] || null;
  P.region = (cc, rn) => { const c = D[cc]; return c ? c.regions.find((r) => r.name === rn) || null : null; };
  P.city = (cc, rn, cn) => { const r = P.region(cc, rn); return r ? r.cities.find((x) => x[0] === cn) || null : null; };
  /** tz / method / madhab for a country (+ region overrides). */
  P.rules = function (cc, rn) {
    const c = D[cc]; if (!c) return null;
    const r = P.region(cc, rn) || {};
    return { tz: r.tz || c.tz, method: r.method || c.method, madhab: r.madhab || c.madhab };
  };
  P.findCountryByName = (name) => Object.values(D).find((c) => c.name.toLowerCase() === String(name || '').toLowerCase()) || null;
  P.findRegion = function (cc, name) {
    const c = D[cc]; if (!c || !name) return null;
    const n = String(name).toLowerCase().replace(/^(state of|province of)\s+/, '');
    return c.regions.find((r) => r.name.toLowerCase() === n || n.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(n)) || null;
  };
  /** Old settings (city only) → hierarchy, best effort. */
  P.fromLegacy = function (loc) {
    if (loc && loc.countryCode) return loc;
    for (const c of Object.values(D)) for (const r of c.regions) for (const x of r.cities) {
      if (loc && Math.abs(x[1] - loc.lat) < 0.02 && Math.abs(x[2] - loc.lng) < 0.02) return Object.assign({}, loc, { countryCode: c.code, country: c.name, region: r.name, city: x[0], area: loc.area || '' });
    }
    return Object.assign({ countryCode: '', country: '', region: '', city: (loc && loc.city) || '', area: '' }, loc || {});
  };
  P.label = (v) => [v.area, v.city].filter(Boolean).join(', ');

  /* ---------------------------------------------------------------- OpenStreetMap search */
  const OSM = 'https://nominatim.openstreetmap.org';
  function fromOsm(item) {
    const a = item.address || {};
    const cc = String(a.country_code || '').toUpperCase();
    const known = D[cc];
    const regionName = a.state || a.region || a.province || a.state_district || '';
    const reg = known ? P.findRegion(cc, regionName) : null;
    const city = a.city || a.town || a.village || a.municipality || a.city_district || a.county || a.suburb || item.name || '';
    const area = a.suburb || a.neighbourhood || a.quarter || a.residential || a.hamlet || '';
    let tz = '', method = 'MuslimWorldLeague', madhab = 'shafi';
    const rules = known ? P.rules(cc, reg ? reg.name : null) : null;
    if (rules) { tz = rules.tz; method = rules.method; madhab = rules.madhab; }
    else { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* */ } }
    return {
      countryCode: cc, country: known ? known.name : (a.country || ''), region: reg ? reg.name : regionName,
      city, area: area && area !== city ? area : '', lat: +(+item.lat).toFixed(4), lng: +(+item.lon).toFixed(4),
      tz, method, madhab, custom: true, display: item.display_name
    };
  }
  P.search = async function (q, lang) {
    const r = await fetch(`${OSM}/search?format=jsonv2&addressdetails=1&limit=7&accept-language=${encodeURIComponent(lang || 'en')}&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Search failed (' + r.status + ')');
    return (await r.json()).map(fromOsm);
  };
  P.reverse = async function (lat, lng, lang) {
    const r = await fetch(`${OSM}/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=${encodeURIComponent(lang || 'en')}&lat=${lat}&lon=${lng}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Lookup failed (' + r.status + ')');
    return fromOsm(await r.json());
  };

  /* ---------------------------------------------------------------- picker UI */
  const CSS = `
  .mp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .mp-f{display:block;margin-bottom:12px}
  .mp-f>span{display:flex;align-items:center;gap:8px;font-size:13.5px;color:rgba(255,255,255,.66);margin-bottom:6px}
  .mp-f>span b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(243,201,107,.18);color:#f3c96b;font-size:11.5px;font-weight:700}
  .mp-f select,.mp-f input,.mp-s input{width:100%}
  .mp-info{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:rgba(255,255,255,.6);padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.22);border:1px dashed rgba(255,255,255,.14);margin-bottom:10px}
  .mp-info i{font-style:normal;color:#fff}
  .mp-acts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
  .mp-btn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;border-radius:11px;padding:8px 13px;font:inherit;font-size:14px;cursor:pointer}
  .mp-btn.pri{background:#f3c96b;color:#1b1306;border-color:#f3c96b;font-weight:600}
  .mp-s{display:none;margin:8px 0 12px;padding:12px;border-radius:14px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.12)}
  .mp-s.show{display:block}
  .mp-sr{display:flex;gap:8px}
  .mp-res{margin-top:8px;max-height:260px;overflow:auto}
  .mp-res button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:none;color:#fff;font:inherit;font-size:14px;padding:10px 6px;cursor:pointer}
  .mp-res button:hover{background:rgba(255,255,255,.06)}
  .mp-res small{display:block;color:rgba(255,255,255,.5);font-size:12px}
  .mp-msg{font-size:13px;color:rgba(255,255,255,.6);padding:6px 2px}
  @media (max-width:560px){.mp-grid{grid-template-columns:1fr}}`;
  let cssDone = false;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const METHOD_NAMES = { Karachi: 'Karachi', MuslimWorldLeague: 'Muslim World League', Dubai: 'Dubai', UmmAlQura: 'Umm al-Qura', Egyptian: 'Egyptian', Kuwait: 'Kuwait', Qatar: 'Qatar', Singapore: 'Singapore/MUIS', Turkey: 'Diyanet', NorthAmerica: 'ISNA', MoonsightingCommittee: 'Moonsighting Committee', Tehran: 'Tehran', Custom: 'Custom' };

  /**
   * mount(el, value, onChange) — renders the 4-level picker.
   * value: { countryCode, country, region, city, area, lat, lng, tz, method, madhab }
   * onChange(value, kind) — kind: 'country' | 'region' | 'city' | 'area' | 'search' | 'geo'
   */
  P.mount = function (el, value, onChange, opts) {
    opts = opts || {};
    if (!cssDone) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }
    let v = Object.assign({}, P.fromLegacy(value || {}));
    if (!v.countryCode && !v.city) { // first use: guess from browser time zone
      let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* */ }
      const c = Object.values(D).find((x) => x.tz === tz || x.regions.some((r) => r.tz === tz)) || D.IN;
      setCountry(c.code, true);
    }
    const uid = 'mp' + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `
      <div class="mp-grid">
        <label class="mp-f"><span><b>1</b>Country</span><select data-k="country"></select></label>
        <label class="mp-f"><span><b>2</b>Region / State</span><select data-k="region"></select></label>
      </div>
      <div class="mp-grid">
        <label class="mp-f"><span><b>3</b>City / Town</span><select data-k="city"></select></label>
        <label class="mp-f"><span><b>4</b>Area / Locality <i style="font-style:normal;opacity:.6">(optional)</i></span><input type="text" data-k="area" list="${uid}" maxlength="80" placeholder="e.g. Kuttichira" autocomplete="off"><datalist id="${uid}"></datalist></label>
      </div>
      <div class="mp-info" data-k="info"></div>
      <div class="mp-acts"><button type="button" class="mp-btn" data-a="search">🔎 Not in the list? Search any place</button><button type="button" class="mp-btn" data-a="geo">📍 Use my current location</button></div>
      <div class="mp-s" data-k="sbox"><div class="mp-sr"><input type="text" data-k="q" placeholder="Town, area or masjid address…"><button type="button" class="mp-btn pri" data-a="go">Search</button></div><div class="mp-res" data-k="res"></div></div>`;
    const $ = (k) => el.querySelector(`[data-k="${k}"]`);

    function setCountry(cc, silent) {
      const c = D[cc]; if (!c) return;
      const r = c.regions.find((x) => x.name === c.def) || c.regions[0];
      v.countryCode = cc; v.country = c.name; setRegion(r.name, true);
      if (!silent) emit('country');
    }
    function setRegion(rn, silent) {
      const r = P.region(v.countryCode, rn); if (!r) return;
      v.region = r.name; setCity(r.def && r.cities.some((x) => x[0] === r.def) ? r.def : r.cities[0][0], true);
      Object.assign(v, P.rules(v.countryCode, r.name));
      if (!silent) emit('region');
    }
    function setCity(cn, silent) {
      const x = P.city(v.countryCode, v.region, cn); if (!x) return;
      v.city = x[0]; v.lat = x[1]; v.lng = x[2]; v.area = ''; v.custom = false;
      if (!silent) emit('city');
    }
    function emit(kind) { draw(); if (onChange) onChange(Object.assign({}, v), kind); }

    function draw() {
      const c = D[v.countryCode];
      // countries
      let h = P.countries().map((x) => `<option value="${x.code}" ${x.code === v.countryCode ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
      if (!c) h = `<option value="" selected>${esc(v.country || 'Other')}</option>` + h;
      $('country').innerHTML = h;
      // regions
      const regs = c ? c.regions : [];
      const knownReg = regs.some((r) => r.name === v.region);
      $('region').innerHTML = (!knownReg ? `<option value="" selected>${esc(v.region || '—')}</option>` : '') +
        regs.map((r) => `<option ${r.name === v.region ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
      // cities (grouped by district where available)
      const reg = P.region(v.countryCode, v.region);
      const cities = reg ? reg.cities : [];
      const knownCity = cities.some((x) => x[0] === v.city);
      let ch = !knownCity ? `<option value="" selected>${esc(v.city || '—')}${v.custom ? ' (from search)' : ''}</option>` : '';
      let grp = null;
      for (const x of cities) {
        if (x[3] && x[3] !== grp) { if (grp) ch += '</optgroup>'; grp = x[3]; ch += `<optgroup label="${esc(grp)} district">`; }
        ch += `<option ${x[0] === v.city ? 'selected' : ''}>${esc(x[0])}</option>`;
      }
      if (grp) ch += '</optgroup>';
      ch += '<option value="__search">Other town / not listed — search…</option>';
      $('city').innerHTML = ch;
      // areas
      $('area').value = v.area || '';
      el.querySelector('datalist').innerHTML = (AREAS[`${v.countryCode}|${v.region}|${v.city}`] || []).map((a) => `<option value="${esc(a)}">`).join('');
      // info line
      $('info').innerHTML = `<span>📍 <i>${Number(v.lat).toFixed(4)}, ${Number(v.lng).toFixed(4)}</i></span><span>🕰 <i>${esc(v.tz || 'device time zone')}</i></span><span>📐 <i>${esc(METHOD_NAMES[v.method] || v.method || '')}</i></span><span>Asr <i>${v.madhab === 'hanafi' ? 'Hanafi' : "Shafi'i"}</i></span>`;
    }

    el.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (k === 'country' && e.target.value) setCountry(e.target.value);
      else if (k === 'region' && e.target.value) setRegion(e.target.value);
      else if (k === 'city') { if (e.target.value === '__search') { openSearch(); draw(); } else if (e.target.value) setCity(e.target.value); }
    });
    el.addEventListener('input', (e) => { if (e.target.dataset.k === 'area') { v.area = e.target.value.trim(); if (onChange) onChange(Object.assign({}, v), 'area'); } });
    el.addEventListener('keydown', (e) => { if (e.target.dataset.k === 'q' && e.key === 'Enter') { e.preventDefault(); runSearch(); } });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'search') openSearch();
      if (a.dataset.a === 'go') runSearch();
      if (a.dataset.a === 'geo') useGeo();
      if (a.dataset.a === 'pick') { v = Object.assign(v, RESULTS[+a.dataset.i]); $('sbox').classList.remove('show'); emit('search'); }
    });
    let RESULTS = [];
    function openSearch() { $('sbox').classList.add('show'); const q = $('q'); q.value = q.value || [v.city, v.region, v.country].filter(Boolean).join(', '); q.focus(); q.select(); }
    async function runSearch() {
      const q = $('q').value.trim(); if (q.length < 2) return;
      $('res').innerHTML = '<div class="mp-msg">Searching…</div>';
      try {
        RESULTS = await P.search(q, opts.lang);
        $('res').innerHTML = RESULTS.length ? RESULTS.map((x, i) => `<button type="button" data-a="pick" data-i="${i}">${esc([x.area, x.city].filter(Boolean).join(', ') || x.display.split(',')[0])}<small>${esc([x.region, x.country].filter(Boolean).join(', '))} · ${x.lat}, ${x.lng}</small></button>`).join('')
          : '<div class="mp-msg">No places found. Try a nearby town name.</div>';
      } catch (err) { $('res').innerHTML = `<div class="mp-msg">Search needs internet (${esc(err.message)}).</div>`; }
    }
    function useGeo() {
      if (!navigator.geolocation) return msg('Location is not available on this device.');
      if (!window.isSecureContext) return msg('Location needs a secure (https) page. Use search instead.');
      msg('Getting your location…');
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = +pos.coords.latitude.toFixed(4), lng = +pos.coords.longitude.toFixed(4);
        try { const x = await P.reverse(lat, lng, opts.lang); x.lat = lat; x.lng = lng; v = Object.assign(v, x); $('sbox').classList.remove('show'); emit('geo'); }
        catch (e) { v.lat = lat; v.lng = lng; v.custom = true; v.city = v.city || 'My location'; emit('geo'); }
      }, (err) => msg(err.message), { enableHighAccuracy: true, timeout: 20000 });
    }
    function msg(t) { $('sbox').classList.add('show'); $('res').innerHTML = `<div class="mp-msg">${esc(t)}</div>`; }

    draw();
    return { get value() { return Object.assign({}, v); }, set(nv) { v = Object.assign({}, P.fromLegacy(nv)); draw(); } };
  };

  g.MeeqatPlaces = P;
})(window);
