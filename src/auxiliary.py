def clean_price(text):
    return float(text.replace(".", "").replace(",", ".").replace("R$", " "))
    
def clean_pct(text):
    return int(text.replace("-", "").replace("%", ""))